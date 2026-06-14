'use client'

import { useEffect, useRef, useState } from 'react'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  Background,
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
      65%  { transform: scale(1.12); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }`
    document.head.appendChild(el)
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_RADIUS = 28
const FACTUAL_HEX = '#7B9EFF'
const PRACTICAL_HEX = '#F4B97A'
const DRIFT = 0.15

function typeHex(type: NodeType) {
  return type === 'factual' ? FACTUAL_HEX : PRACTICAL_HEX
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
}

const handleStyle: React.CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
}

function OrbNode({ data }: NodeProps<OrbData>) {
  const [blooming, setBlooming] = useState(false)

  useEffect(() => {
    if (!data.isNew) return
    setBlooming(true)
    const t = setTimeout(() => setBlooming(false), 450)
    return () => clearTimeout(t)
  }, [data.isNew])

  const hex = typeHex(data.nodeType)

  let boxShadow: string
  if (blooming) {
    boxShadow = `0 0 0 2px ${hex}, 0 0 40px ${hex}cc, 0 0 80px ${hex}60, inset 0 1px 1px rgba(255,255,255,0.2)`
  } else if (data.isActive) {
    boxShadow = `0 0 0 2px ${hex}, 0 0 32px ${hex}80, inset 0 1px 1px rgba(255,255,255,0.2)`
  } else {
    boxShadow = 'inset 0 1px 1px rgba(255,255,255,0.12)'
  }

  return (
    <div
      style={{
        width: NODE_RADIUS * 2,
        height: NODE_RADIUS * 2,
        position: 'relative',
        animation: data.isNew ? 'orb-bloom 500ms cubic-bezier(0,0,0.2,1) forwards' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `${hex}20`,
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: `1.5px solid ${hex}66`,
          boxShadow,
          transition: 'box-shadow 400ms cubic-bezier(0,0,0.2,1)',
          cursor: 'pointer',
        }}
      />
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
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return

        const elanNodes = data as ElanNode[]
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
            data: { nodeType: n.type, depth: n.depth, isActive: false, isNew: newNodeIds.has(n.id) },
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
              style: { stroke: hex, strokeOpacity: 0.35, strokeWidth: 1.5 },
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
          setTimeout(() => {
            setNodes((nds) =>
              nds.map((n) => newNodeIds.has(n.id) ? { ...n, data: { ...n.data, isNew: false } } : n)
            )
          }, 600)
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

      {Object.keys(ringRadii).length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
          <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
            {Object.entries(ringRadii).map(([depth, r]) => (
              <circle
                key={depth}
                cx={center.cx}
                cy={center.cy}
                r={r}
                style={{ fill: 'none', stroke: 'var(--panel-border)', strokeWidth: 1, opacity: 1 }}
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
        onInit={(rf) => setViewport(rf.getViewport())}
        onMove={(_, vp) => setViewport(vp)}
        onMoveStart={() => { userOverrideRef.current = true }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background color="rgba(172, 172, 172, 0.4)" gap={64} size={2} />
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
