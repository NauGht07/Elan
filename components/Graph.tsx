'use client'

import { useEffect, useRef, useState } from 'react'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore as useRfStore,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceRadial,
  type SimulationNodeDatum,
} from 'd3-force'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { ElanNode, NodeType } from '@/types'

// ─── Bloom keyframe ──────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  const id = 'elan-orb-bloom'
  if (!document.getElementById(id)) {
    const el = document.createElement('style')
    el.id = id
    el.textContent = `@keyframes orb-bloom {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.14); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes ink-spread {
      0%   { transform: scale(0.55); opacity: 0.5; }
      100% { transform: scale(1.95); opacity: 0; }
    }
    @keyframes edge-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    `
    document.head.appendChild(el)
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_RADIUS = 28
const FACTUAL_HEX = '#009DDC'
const PRACTICAL_HEX = '#F5821F'
const DRIFT = 0.15
const TEXTURE_SIZE = 2400

function typeHex(type: NodeType) {
  return type === 'factual' ? FACTUAL_HEX : PRACTICAL_HEX
}

// Mix a hex color toward white — used for the sticker's "paper backing" fold
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function spawnPosition(
  depth: number,
  parentSnap: { x: number; y: number } | undefined,
  cx: number,
  cy: number,
): { x: number; y: number } {
  if (!parentSnap) return { x: cx, y: cy }
  const radius = 250 + (depth - 1) * 200
  const angle = Math.atan2(parentSnap.y - cy, parentSnap.x - cx) + (Math.random() - 0.5) * 0.6
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

// ─── D3 types ────────────────────────────────────────────────────────────────

interface D3SimNode extends SimulationNodeDatum {
  id: string
  nodeType: NodeType
  depth: number
}

// ─── Custom orb node ─────────────────────────────────────────────────────────

interface OrbData {
  nodeType: NodeType
  depth: number
  isActive: boolean
  isNew: boolean
  bloomDelay: number
  topic: string
  hasAnnotations: boolean
  hasChat: boolean
  emoji: string[]
}

const handleStyle: React.CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
}

// ─── Indicator badges ──────────────────────────────────────────────────────────

const BADGE_SIZE = 15

// Small sticker-style badge that floats on the document's outer edge. x/y are the
// badge centre in container coordinates; pointer events pass through to the node.
function Badge({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - BADGE_SIZE / 2,
        top: y - BADGE_SIZE / 2,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: '50%',
        background: '#F1E8D6',
        border: '1px solid rgba(40,30,22,0.15)',
        boxShadow: '0 1px 3px rgba(40,30,22,0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B5E4E',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}

const iconProps = {
  width: 9,
  height: 9,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const PaperclipIcon = () => (
  <svg {...iconProps}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

// Deterministic [0,1) pseudo-random from a string seed — keeps emoji placement
// stable across re-renders (same node id + index → same position)
function seededUnit(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

// Per-index base anchors (fractions of the document half-extents, from centre),
// spread across the face and biased away from the top-right dog-ear.
const EMOJI_ANCHORS = [
  { fx: -0.32, fy: -0.12 },
  { fx: 0.28, fy: 0.16 },
  { fx: -0.02, fy: 0.42 },
]

function OrbNode({ id, data }: NodeProps<OrbData>) {
  const [blooming, setBlooming] = useState(false)
  const zoom = useRfStore(s => s.transform[2])

  useEffect(() => {
    if (!data.isNew) return
    // Delay the ink-spread ring so it fires when this node actually blooms in
    // (depth-staggered on initial load), not at t=0.
    let endT: ReturnType<typeof setTimeout>
    const startT = setTimeout(() => {
      setBlooming(true)
      endT = setTimeout(() => setBlooming(false), 600)
    }, data.bloomDelay)
    return () => {
      clearTimeout(startT)
      clearTimeout(endT)
    }
  }, [data.isNew, data.bloomDelay])

  const hex = typeHex(data.nodeType)
  const isRoot = data.depth === 0
  const lifted = data.isActive || blooming

  const labelVariant = zoom < 0.6 ? 'hidden' : zoom > 1.2 ? 'full' : 'small'
  const labelText =
    labelVariant === 'small' && data.topic.length > 20
      ? data.topic.slice(0, 20) + '…'
      : data.topic

  const filter = lifted
    ? 'drop-shadow(0 10px 22px rgba(40,30,22,0.26)) drop-shadow(0 3px 8px rgba(40,30,22,0.14))'
    : 'drop-shadow(0 4px 12px rgba(40,30,22,0.18))'

  // Badge anchors — derived from the visible document size so they track the icon
  // edge at both the root (×4) and normal (×3) scale. Scattered for an organic feel.
  const svgSize = isRoot ? NODE_RADIUS * 4 : NODE_RADIUS * 3
  const c = NODE_RADIUS // container centre (container box is NODE_RADIUS * 2)
  const halfW = svgSize * 0.26 // document rect half-width in container px
  const halfH = svgSize * 0.36 // document rect half-height in container px
  const hasAttachment = false // attachments not built yet — position reserved

  return (
    <div
      style={{
        width: NODE_RADIUS * 2,
        height: NODE_RADIUS * 2,
        position: 'relative',
        animation: data.isNew ? `orb-bloom 600ms cubic-bezier(0,0,0.2,1) ${data.bloomDelay}ms both` : undefined,
        filter,
        transform: data.isActive ? 'scale(1.18)' : 'scale(1)',
        transition: 'filter 400ms cubic-bezier(0,0,0.2,1), transform 400ms cubic-bezier(0,0,0.2,1)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <svg
        viewBox="0 0 100 100"
        style={{
          display: 'block',
          overflow: 'visible',
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: isRoot ? NODE_RADIUS * 4 : NODE_RADIUS * 3,
          height: isRoot ? NODE_RADIUS * 4 : NODE_RADIUS * 3,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {blooming && (
          <circle
            cx="50" cy="50" r="40" fill="none" stroke={hex} strokeWidth="3"
            style={{ transformOrigin: '50px 50px', animation: 'ink-spread 600ms cubic-bezier(0,0,0.2,1) forwards' }}
          />
        )}
        {/* Document body — rounded-corner page with the top-right corner folded away, no outline */}
        <path d="M30 14 L58 14 L76 32 L76 80 A6 6 0 0 1 70 86 L30 86 A6 6 0 0 1 24 80 L24 20 A6 6 0 0 1 30 14 Z" fill={hex} />
        {/* Dog-ear — folded top-right corner showing lighter paper backing, rounded inner vertex, with localized fold shadow */}
        <g filter="url(#fold-shadow)">
          <path d="M58 14 L76 32 L64 32 Q58 32 58 26 L58 14 Z" fill={lighten(hex, 0.45)} />
        </g>
        {/* Content lines — suggest text on the page, a lighter shade of the node color */}
        <g stroke={lighten(hex, 0.4)} strokeWidth="3" strokeLinecap="round">
          <line x1="33" y1="44" x2="67" y2="44" />
          <line x1="33" y1="54" x2="67" y2="54" />
          <line x1="33" y1="64" x2="67" y2="64" />
          <line x1="33" y1="74" x2="55" y2="74" />
        </g>
      </svg>
      {/* Emoji stickers — scattered on the document face, seeded by node id so stable */}
      {data.emoji.map((emoji, i) => {
        const anchor = EMOJI_ANCHORS[i] ?? EMOJI_ANCHORS[EMOJI_ANCHORS.length - 1]
        const jx = (seededUnit(`${id}:x${i}`) - 0.5) * 0.28
        const jy = (seededUnit(`${id}:y${i}`) - 0.5) * 0.28
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: c + (anchor.fx + jx) * halfW,
              top: c + (anchor.fy + jy) * halfH,
              transform: 'translate(-50%, -50%)',
              fontSize: 13,
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {emoji}
          </span>
        )
      })}
      {/* Indicator badges — float on the document's outer edge, only when relevant */}
      {data.hasAnnotations && (
        <Badge x={c - halfW} y={c + halfH * 0.08}><PencilIcon /></Badge>
      )}
      {data.hasChat && (
        <Badge x={c - halfW * 0.5} y={c + halfH}><ChatIcon /></Badge>
      )}
      {hasAttachment && (
        <Badge x={c + halfW * 0.62} y={c + halfH * 0.95}><PaperclipIcon /></Badge>
      )}
      {labelVariant !== 'hidden' && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: isRoot ? 28 : 14,
            fontSize: labelVariant === 'full' ? 11 : 9,
            lineHeight: 1.4,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            maxWidth: isRoot ? NODE_RADIUS * 4 : NODE_RADIUS * 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          {labelText}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}

// ─── Camera controller ───────────────────────────────────────────────────────

const FOLLOW_ZOOM = 1.5

interface CameraControllerProps {
  activeNodeId: string | null
  fitViewTrigger: number
  rfNodes: Node<OrbData>[]
  cx: number
  cy: number
  selectedTreeId: string | null
  nodesTreeId: string | null
  userOverrideRef: React.MutableRefObject<boolean>
}

function CameraController({ activeNodeId, fitViewTrigger, rfNodes, cx, cy, selectedTreeId, nodesTreeId, userOverrideRef }: CameraControllerProps) {
  const { fitView, setViewport } = useReactFlow()
  const nullFiredForRef = useRef<string | null>(null)

  useEffect(() => {
    if (fitViewTrigger === 0) return
    fitView({ padding: 0.3, duration: 600 })
  }, [fitViewTrigger])

  useEffect(() => {
    if (activeNodeId !== null) {
      nullFiredForRef.current = null
      return
    }
    if (nodesTreeId !== selectedTreeId) return
    if (rfNodes.length === 0) return
    if (nullFiredForRef.current === selectedTreeId) return
    nullFiredForRef.current = selectedTreeId

    const maxDepth = rfNodes.reduce((max, n) => Math.max(max, n.data.depth), 0)
    let zoom: number
    if (maxDepth === 0) {
      zoom = 1
    } else {
      const maxRadius = 250 + (maxDepth - 1) * 200
      zoom = Math.min(1, Math.max(0.25, (cx * 2 * 0.3) / maxRadius))
    }
    setViewport(
      { x: cx * (1 - zoom), y: cy * (1 - zoom), zoom },
      { duration: 600 },
    )
  }, [activeNodeId, rfNodes, nodesTreeId])

  useEffect(() => {
    if (!activeNodeId) return
    if (userOverrideRef.current) return
    const node = rfNodes.find((n) => n.id === activeNodeId)
    if (!node) return
    const targetX = node.position.x + NODE_RADIUS
    const targetY = node.position.y + NODE_RADIUS
    setViewport(
      { x: cx - targetX * FOLLOW_ZOOM, y: cy - targetY * FOLLOW_ZOOM, zoom: FOLLOW_ZOOM },
      { duration: 150 },
    )
  }, [activeNodeId, rfNodes])

  return null
}

const nodeTypes = { orb: OrbNode }

// ─── Graph ───────────────────────────────────────────────────────────────────

export default function Graph() {
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const graphVersion = useStore((s) => s.graphVersion)
  const activeNodeId = useStore((s) => s.activeNodeId)
  const setActiveNodeId = useStore((s) => s.setActiveNodeId)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)

  const [rfNodes, setNodes, onNodesChange] = useNodesState<OrbData>([])
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState([])
  const [ringRadii, setRingRadii] = useState<Record<number, number>>({})
  const [center, setCenter] = useState({ cx: 0, cy: 0 })
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [nodesTreeId, setNodesTreeId] = useState<string | null>(null)

  const [fitViewTrigger, setFitViewTrigger] = useState(0)

  const simRef = useRef<{ stop(): void; alpha(v: number): { restart(): void }; restart(): void } | null>(null)
  const d3NodeMapRef = useRef<Map<string, D3SimNode>>(new Map())
  const activeNodeIdRef = useRef<string | null>(activeNodeId)
  const containerRef = useRef<HTMLDivElement>(null)
  const posSnapshotRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const prevTreeIdRef = useRef<string | null>(null)
  const userOverrideRef = useRef(false)

  // Keep ref current so the d3 tick closure always reads the latest value
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId
  }, [activeNodeId])

  // Reset override whenever activeNodeId becomes non-null (covers suggestion-spawned nodes)
  useEffect(() => {
    if (activeNodeId !== null) userOverrideRef.current = false
  }, [activeNodeId])

  useEffect(() => {
    const snapshot = new Map<string, { x: number; y: number }>()
    for (const [id, d] of d3NodeMapRef.current) {
      if (d.x != null && d.y != null) snapshot.set(id, { x: d.x, y: d.y })
    }
    posSnapshotRef.current = snapshot

    simRef.current?.stop()
    simRef.current = null

    if (!selectedTreeId) {
      setNodes([])
      setEdges([])
      setRingRadii({})
      return
    }

    const supabase = createBrowserClient()
    let cancelled = false

    supabase
      .from('nodes')
      .select('*')
      .eq('tree_id', selectedTreeId)
      .order('depth', { ascending: true })
      .then(async ({ data }) => {
        if (cancelled || !data || data.length === 0) return

        const elanNodes = data as ElanNode[]

        // Badge data — fetch which nodes have annotations / chat messages once per
        // tree load (annotations & node_chats carry no tree_id, so filter by node_id)
        const nodeIds = elanNodes.map((n) => n.id)
        const [annRes, chatRes] = await Promise.all([
          supabase.from('annotations').select('node_id, text, anchor_type').in('node_id', nodeIds).order('created_at'),
          supabase.from('node_chats').select('node_id').in('node_id', nodeIds),
        ])
        if (cancelled) return
        // Pencil badge — note annotations only (exclude emoji rows), non-empty text
        const annotatedIds = new Set(
          (annRes.data ?? [])
            .filter((r) => r.anchor_type !== 'emoji' && (r.text ?? '').trim().length > 0)
            .map((r) => r.node_id)
        )
        // Emoji stickers — grouped per node, capped at 3
        const emojiByNode = new Map<string, string[]>()
        for (const r of annRes.data ?? []) {
          if (r.anchor_type !== 'emoji' || !r.text) continue
          const arr = emojiByNode.get(r.node_id) ?? []
          if (arr.length < 3) arr.push(r.text)
          emojiByNode.set(r.node_id, arr)
        }
        const chatIds = new Set((chatRes.data ?? []).map((r) => r.node_id))

        const cx = (containerRef.current?.offsetWidth ?? 800) / 2
        const cy = (containerRef.current?.offsetHeight ?? 600) / 2

        // Build d3 nodes — existing nodes resume from last position, new node spawns on its ring
        const d3Nodes: D3SimNode[] = elanNodes.map((n) => {
          const snap = posSnapshotRef.current.get(n.id)
          const parentSnap = n.parent_id ? posSnapshotRef.current.get(n.parent_id) : undefined
          const pos = snap ?? spawnPosition(n.depth, parentSnap, cx, cy)
          return {
            id: n.id,
            x: pos.x,
            y: pos.y,
            nodeType: n.type,
            depth: n.depth,
            fx: n.depth === 0 ? cx : undefined,
            fy: n.depth === 0 ? cy : undefined,
          }
        })

        const d3NodeMap = new Map(d3Nodes.map((n) => [n.id, n]))
        d3NodeMapRef.current = d3NodeMap

        // Links: parent_id → child
        const d3Links = elanNodes
          .filter((n) => n.parent_id !== null)
          .map((n) => ({ source: n.parent_id as string, target: n.id }))

        const newNodeIds = new Set(
          elanNodes.filter((n) => !posSnapshotRef.current.has(n.id)).map((n) => n.id)
        )

        // Fresh tree load (vs. an incremental single-node add via graphVersion). On a
        // fresh load every node blooms; we stagger them by depth so the tree grows
        // outward from the root rather than exploding from a single point.
        const isInitialLoad = prevTreeIdRef.current !== selectedTreeId

        // Initial RF nodes — existing at last position, new on its ring near parent angle
        const initRfNodes: Node<OrbData>[] = elanNodes.map((n) => {
          const snap = posSnapshotRef.current.get(n.id)
          const parentSnap = n.parent_id ? posSnapshotRef.current.get(n.parent_id) : undefined
          const pos = snap ?? spawnPosition(n.depth, parentSnap, cx, cy)
          const x = pos.x - NODE_RADIUS
          const y = pos.y - NODE_RADIUS
          return {
            id: n.id,
            type: 'orb',
            position: { x, y },
            data: { nodeType: n.type, depth: n.depth, isActive: false, isNew: newNodeIds.has(n.id), bloomDelay: isInitialLoad ? n.depth * 300 : 0, topic: n.original_query, hasAnnotations: annotatedIds.has(n.id), hasChat: chatIds.has(n.id), emoji: emojiByNode.get(n.id) ?? [] },
          }
        })

        // React Flow edges — colored to match source node type
        const initRfEdges: Edge[] = elanNodes
          .filter((n) => n.parent_id !== null)
          .map((n) => {
            const childD3 = d3NodeMap.get(n.id)
            const hex = childD3 ? typeHex(childD3.nodeType) : FACTUAL_HEX
            return {
              id: `${n.parent_id}-${n.id}`,
              source: n.parent_id as string,
              target: n.id,
              type: 'straight',
              style: {
                stroke: hex,
                strokeOpacity: 0.45,
                strokeWidth: 1.6,
                strokeLinecap: 'round',
                filter: 'url(#ink-rough)',
                // Fade in alongside the target node (child at depth n.depth) on initial load
                animation: isInitialLoad
                  ? `edge-fade 400ms cubic-bezier(0,0,0.2,1) ${n.depth * 300}ms both`
                  : undefined,
              },
            }
          })

        setNodes(initRfNodes)
        setEdges(initRfEdges)
        setCenter({ cx, cy })
        setNodesTreeId(selectedTreeId)

        if (prevTreeIdRef.current !== selectedTreeId) {
          prevTreeIdRef.current = selectedTreeId
          setFitViewTrigger((v) => v + 1)
        }

        if (newNodeIds.size > 0) {
          // Keep isNew alive until the last (deepest) staggered bloom has finished,
          // otherwise a deep node's animation is removed before it even starts.
          const maxNewDepth = elanNodes.reduce(
            (max, n) => (newNodeIds.has(n.id) ? Math.max(max, n.depth) : max),
            0,
          )
          const resetAfter = (isInitialLoad ? maxNewDepth * 300 : 0) + 600
          setTimeout(() => {
            setNodes((nds) =>
              nds.map((n) => newNodeIds.has(n.id) ? { ...n, data: { ...n.data, isNew: false } } : n)
            )
          }, resetAfter)
        }

        // d3-force simulation
        const simulation = forceSimulation<D3SimNode>(d3Nodes)
          .force(
            'link',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            forceLink<D3SimNode, any>(d3Links)
              .id((d) => d.id)
              .distance(140)
              .strength(0.8),
          )
          .force('charge', forceManyBody<D3SimNode>().strength(-800))
          .force('center', forceCenter<D3SimNode>(cx, cy).strength(0.05))
          .force('collide', forceCollide<D3SimNode>(NODE_RADIUS + 10))
          .force(
            'radial',
            forceRadial<D3SimNode>(
              (d) => d.depth === 0 ? 0 : 250 + (d.depth - 1) * 200,
              cx,
              cy,
            ).strength((d) => d.depth === 0 ? 0 : 0.9),
          )
          .force('tangential', () => {
            for (const d of d3Nodes) {
              if (d.depth === 0 || d.x == null || d.y == null) continue
              const dx = d.x - cx
              const dy = d.y - cy
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len < 1) continue
              d.vx = (d.vx ?? 0) + (-dy / len) * DRIFT
              d.vy = (d.vy ?? 0) + (dx / len) * DRIFT
            }
          })
          .alphaTarget(0.05)
          .alphaDecay(0.02)

        simulation.on('tick', () => {
          // Compute average distance from center per depth for ring circles
          const acc: Record<number, { sum: number; count: number }> = {}
          for (const d of d3Nodes) {
            if (d.depth === 0 || d.x == null || d.y == null) continue
            const dist = Math.sqrt((d.x - cx) ** 2 + (d.y - cy) ** 2)
            if (!acc[d.depth]) acc[d.depth] = { sum: 0, count: 0 }
            acc[d.depth].sum += dist
            acc[d.depth].count++
          }
          const newRadii: Record<number, number> = {}
          for (const [k, { sum, count }] of Object.entries(acc)) newRadii[+k] = sum / count
          setRingRadii(newRadii)

          setNodes((nds) =>
            nds.map((rfNode) => {
              const d = d3NodeMap.get(rfNode.id)
              if (!d || d.x == null || d.y == null) return rfNode
              return {
                ...rfNode,
                position: { x: d.x - NODE_RADIUS, y: d.y - NODE_RADIUS },
                data: {
                  ...rfNode.data,
                  isActive: activeNodeIdRef.current === rfNode.id,
                },
              }
            }),
          )

        })

        simRef.current = simulation
      })

    return () => {
      cancelled = true
      simRef.current?.stop()
      simRef.current = null
    }
  }, [selectedTreeId, graphVersion])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* Shared hand-drawn "ink" filter — referenced by node rings and edges */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="fold-shadow" x="-75%" y="-75%" width="250%" height="250%">
            <feDropShadow dx="-2.5" dy="4.5" stdDeviation="3.8" floodColor="rgba(0,0,0,0.45)" />
          </filter>
        </defs>
      </svg>

      {/* Paper texture — scrolls and zooms with the graph viewport */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: "url('/paper-texture.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: `${TEXTURE_SIZE * viewport.zoom}px ${TEXTURE_SIZE * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />
      {/* Warm tint overlay — softens texture, theme-aware */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'var(--canvas-overlay)',
          transition: 'background 0.3s cubic-bezier(0,0,0.2,1)',
        }}
      />

      {Object.keys(ringRadii).length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
          <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
            {Object.entries(ringRadii).map(([depth, r]) => (
              <circle
                key={depth}
                cx={center.cx}
                cy={center.cy}
                r={r}
                style={{
                  fill: 'none',
                  stroke: 'var(--ring-stroke)',
                  strokeWidth: 2,
                  strokeDasharray: '4 10',
                  strokeLinecap: 'round',
                }}
              />
            ))}
          </g>
        </svg>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          userOverrideRef.current = false
          setActiveNodeId(node.id)
          setDrawerOpen(true)
        }}
        nodeTypes={nodeTypes}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        onNodeDragStart={(_, node) => {
          const d = d3NodeMapRef.current.get(node.id)
          if (!d || d.depth === 0) return
          d.fx = d.x; d.fy = d.y
        }}
        onNodeDrag={(_, node) => {
          const d = d3NodeMapRef.current.get(node.id)
          if (!d || d.depth === 0 || !simRef.current) return
          d.fx = node.position.x + NODE_RADIUS
          d.fy = node.position.y + NODE_RADIUS
          simRef.current.alpha(0.3).restart()
        }}
        onNodeDragStop={(_, node) => {
          const d = d3NodeMapRef.current.get(node.id)
          if (!d || d.depth === 0) return
          d.fx = undefined; d.fy = undefined
        }}
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        onInit={(rf) => setViewport(rf.getViewport())}
        onMove={(_, vp) => setViewport(vp)}
        onMoveStart={() => { userOverrideRef.current = true }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <CameraController
          activeNodeId={activeNodeId}
          fitViewTrigger={fitViewTrigger}
          rfNodes={rfNodes}
          cx={center.cx}
          cy={center.cy}
          selectedTreeId={selectedTreeId}
          nodesTreeId={nodesTreeId}
          userOverrideRef={userOverrideRef}
        />
      </ReactFlow>
    </div>
  )
}
