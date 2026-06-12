"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  applyNodeChanges,
  useReactFlow,
  useViewport,
  Panel,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodeDrag,
  type NodeChange,
} from "@xyflow/react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  type Simulation,
} from "d3-force";
import { orbitalRadius } from "../page";

const KEYFRAMES = `
  @keyframes nodeEnter {
    0%   { opacity: 0; transform: scale(0); filter: brightness(1); }
    35%  { opacity: 1; transform: scale(1.5);  filter: brightness(2.2); }
    60%  { transform: scale(0.88); filter: brightness(1); }
    80%  { transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); filter: brightness(1); }
  }
`;

const CENTER_HANDLE: React.CSSProperties = {
  opacity: 0,
  pointerEvents: "none",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
};

type NodeData = {
  topic: string;
  summary: string;
  brief: string;
  subtopics: string[];
};

type CircleNodeData = {
  label: string;
  size: number;
  isRoot: boolean;
  isActive: boolean;
  depth: number;
  nodeData: NodeData;
};

type GhostNodeData = {
  label: string;
  parentId: string;
  isPending?: boolean;
  depth: number;
};

type SimNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  depth: number;
  isRoot: boolean;
  isGhost: boolean;
};

function CircleNode({ data }: { data: CircleNodeData }) {
  const [hovered, setHovered] = useState(false);
  const delay = `${(data.depth ?? 0) * 0.07}s`;

  const baseBoxShadow = data.isRoot
    ? data.isActive
      ? "0 0 0 2.5px #c4b5fd, 0 0 0 6px rgba(167,139,250,0.45), 0 0 22px rgba(167,139,250,0.5)"
      : "0 0 0 2.5px #7c3aed, 0 0 0 5px rgba(109,40,217,0.2), 0 0 12px rgba(109,40,217,0.25)"
    : data.isActive
    ? "0 0 0 3px rgba(167,139,250,0.35)"
    : "none";

  const hoverBoxShadow = data.isRoot
    ? "0 0 0 3px #c4b5fd, 0 0 0 9px rgba(167,139,250,0.55), 0 0 30px rgba(167,139,250,0.65)"
    : "0 0 0 3px rgba(167,139,250,0.55), 0 0 16px rgba(167,139,250,0.45)";

  return (
    <>
      <style>{KEYFRAMES}</style>
      <Handle type="target" position={Position.Top} style={CENTER_HANDLE} />
      <Handle type="source" position={Position.Bottom} style={CENTER_HANDLE} />
      <div style={{ width: "100%", height: "100%", animation: `nodeEnter 0.45s ease-out ${delay} both` }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundColor: data.isRoot
              ? data.isActive ? "#7c3aed" : "#6d28d9"
              : data.isActive ? "#a78bfa" : "#7c6ff7",
            boxShadow: hovered ? hoverBoxShadow : baseBoxShadow,
            transform: hovered ? "scale(1.22)" : "scale(1)",
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
            cursor: "grab",
          }}
        />
        {hovered && (
          <div
            style={{
              position: "absolute",
              left: "calc(100% + 10px)",
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              padding: "6px 10px",
              pointerEvents: "none",
              zIndex: 9999,
              minWidth: 120,
              maxWidth: 200,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data.label}
            </div>
            {data.nodeData?.brief && (
              <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 3, lineHeight: 1.4 }}>
                {data.nodeData.brief}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function GhostNode({ data }: { data: GhostNodeData }) {
  const [hovered, setHovered] = useState(false);
  const isPending = !!data.isPending;
  const delay = `${(data.depth ?? 1) * 0.07}s`;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <Handle type="target" position={Position.Top} style={CENTER_HANDLE} />
      <Handle type="source" position={Position.Bottom} style={CENTER_HANDLE} />
      <div style={{ width: "100%", height: "100%", animation: `nodeEnter 0.38s ease-out ${delay} both` }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={!isPending ? "bg-zinc-50 dark:bg-zinc-900" : ""}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            ...(isPending ? { backgroundColor: "rgba(167,139,250,0.15)" } : {}),
            border: isPending ? "1.5px solid #a78bfa" : "1.5px dashed #71717a",
            boxShadow: isPending
              ? hovered ? "0 0 0 5px rgba(167,139,250,0.4)" : "0 0 0 3px rgba(167,139,250,0.2)"
              : hovered ? "0 0 0 3px rgba(113,113,122,0.3)" : "none",
            opacity: isPending ? 1 : hovered ? 0.75 : 0.5,
            transform: hovered ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease, opacity 0.15s ease",
            cursor: "pointer",
          }}
        />
        {(hovered || isPending) && (
          <div
            style={{
              position: "absolute",
              left: "calc(100% + 10px)",
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "#18181b",
              border: `1px solid ${isPending ? "#6d28d9" : "#3f3f46"}`,
              borderRadius: 6,
              padding: "6px 10px",
              pointerEvents: "none",
              zIndex: 9999,
              minWidth: 100,
              maxWidth: 180,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: isPending ? "#c4b5fd" : "#a1a1aa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data.label}
            </div>
            {isPending && (
              <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 2 }}>
                preview
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = { circle: CircleNode, ghost: GhostNode };

const defaultEdgeOptions = {
  type: "straight",
  style: { stroke: "#52525b", strokeWidth: 1 },
};

// Lives inside the ReactFlow context — can use useReactFlow
function CameraController({
  activeNodeId,
  fitViewTrigger,
}: {
  activeNodeId: string | null;
  fitViewTrigger: number;
}) {
  const { fitView, setCenter, getNode, getNodes } = useReactFlow();
  const prevActiveId = useRef<string | null>(null);
  const prevFitTrigger = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fitChanged = fitViewTrigger !== prevFitTrigger.current;
    const activeChanged = activeNodeId !== prevActiveId.current;

    if (fitChanged) prevFitTrigger.current = fitViewTrigger;
    if (activeChanged) prevActiveId.current = activeNodeId;

    // fitViewTrigger wins — called on tree load to show the whole graph
    if (fitChanged && fitViewTrigger > 0) {
      setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 80);
      return;
    }

    if (!activeChanged || !activeNodeId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    // Read position after the simulation has had time to settle.
    // getNode pulls from the live React Flow store which gets D3-pushed positions.
    timerRef.current = setTimeout(() => {
      const node = getNode(activeNodeId);
      if (!node) return;
      const circleCount = getNodes().filter((n) => n.type === "circle").length;
      const w = node.width ?? 13;
      const h = node.height ?? 13;
      if (circleCount <= 1) {
        fitView({ duration: 500, padding: 0.5 });
      } else {
        setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.2, duration: 600 });
      }
    }, 400);
  }, [activeNodeId, fitViewTrigger, fitView, setCenter, getNode, getNodes]);

  return null;
}

function FitViewButton() {
  const { fitView } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => fitView({ duration: 600, padding: 0.15 })}
      style={{
        background: hovered ? "rgba(39,39,42,0.92)" : "rgba(24,24,27,0.82)",
        border: "1px solid #3f3f46",
        borderRadius: 8,
        color: hovered ? "#e4e4e7" : "#a1a1aa",
        cursor: "pointer",
        padding: "5px 10px",
        fontSize: 11,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 6,
        backdropFilter: "blur(6px)",
        transition: "color 0.15s, background 0.15s",
        userSelect: "none",
      }}
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
        <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
      </svg>
      Fit
    </button>
  );
}

function OrbitalRings({
  occupiedDepths,
  rootPos,
}: {
  occupiedDepths: number[];
  rootPos: { x: number; y: number };
}) {
  const { x, y, zoom } = useViewport();
  if (occupiedDepths.length === 0) return null;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 0,
      }}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {occupiedDepths.map((depth) => (
          <circle
            key={depth}
            cx={rootPos.x}
            cy={rootPos.y}
            r={orbitalRadius(depth)}
            fill="none"
            stroke="rgba(167,139,250,0.07)"
            strokeWidth={1.5 / zoom}
          />
        ))}
      </g>
    </svg>
  );
}

export default function GraphPanel({
  nodes,
  edges,
  activeNodeId,
  fitViewTrigger,
  pendingGhostId,
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  activeNodeId: string | null;
  fitViewTrigger: number;
  pendingGhostId: string | null;
  onNodeClick: (id: string, nodeType: string, data: Record<string, unknown>) => void;
}) {
  // Simulation state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simRef = useRef<Simulation<SimNode, any> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const posMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dirtyRef = useRef(false);

  // Keep latest props accessible in effects without re-triggering them
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // useNodesState gives React Flow a single tracked state so it can fire
  // onNodesChange for dimension events — without this, edge endpoints break.
  const [rfNodes, setRfNodes] = useNodesState(nodes);

  // RAF render loop — flushes D3 positions into rfNodes every frame
  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const loop = () => {
      if (dirtyRef.current) {
        const posMap = posMapRef.current;
        setRfNodes((prev) => {
          let changed = false;
          const next = prev.map((n) => {
            const p = posMap.get(n.id);
            if (!p) return n;
            if (Math.abs(p.x - n.position.x) < 0.08 && Math.abs(p.y - n.position.y) < 0.08) return n;
            changed = true;
            return { ...n, position: p };
          });
          return changed ? next : prev;
        });
        dirtyRef.current = false;
      }
      const sim = simRef.current;
      if (isDraggingRef.current || (sim && sim.alpha() > sim.alphaMin())) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        // Final sync on cool-down
        setRfNodes((prev) =>
          prev.map((n) => {
            const p = posMapRef.current.get(n.id);
            return p ? { ...n, position: p } : n;
          })
        );
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [setRfNodes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simRef.current?.stop();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Let React Flow report dimension / selection changes back into rfNodes.
  // We filter out position changes — D3 owns those.
  const handleRfNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nonPosition = changes.filter((c) => c.type !== "position");
      if (nonPosition.length > 0) {
        setRfNodes((prev) => applyNodeChanges(nonPosition, prev));
      }
    },
    [setRfNodes]
  );

  const nodeIds = nodes.map((n) => n.id).join(",");
  const edgeIds = edges.map((e) => e.id).join(",");

  // When nodes are added or removed, sync rfNodes structure while preserving
  // measured dimensions (critical for edge rendering) and current D3 positions.
  useEffect(() => {
    setRfNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return nodesRef.current.map((n) => {
        const existing = prevMap.get(n.id);
        return existing
          ? { ...n, position: existing.position, measured: existing.measured }
          : n;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds, setRfNodes]);

  // D3 simulation setup / update — runs when graph structure changes
  useEffect(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Preserve positions of existing nodes
    const prevPosMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const existingIds = new Set(prevPosMap.keys());

    // Root's current position is the orbital origin for the whole system
    const prevRoot = Array.from(prevPosMap.values()).find((n) => n.isRoot);
    const rootX = prevRoot?.x ?? 0;
    const rootY = prevRoot?.y ?? 0;

    const newSimNodes: SimNode[] = currentNodes.map((node) => {
      const isRoot = !!(node.data as { isRoot?: boolean }).isRoot;
      const isGhost = node.type === "ghost";
      const depth = (node.data as { depth?: number }).depth ?? 0;

      const existing = prevPosMap.get(node.id);
      if (existing) {
        existing.depth = depth;
        existing.isRoot = isRoot;
        existing.isGhost = isGhost;
        return existing;
      }

      // Brand-new root — pin at center to start
      if (isRoot) {
        return { id: node.id, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0, depth: 0, isRoot: true, isGhost: false };
      }

      // New non-root node — spawn at parent, burst radially away from root (electron jump)
      const parentEdge = currentEdges.find((e) => e.target === node.id);
      const parentSim = parentEdge ? prevPosMap.get(parentEdge.source) : null;
      const px = parentSim?.x ?? node.position.x ?? rootX;
      const py = parentSim?.y ?? node.position.y ?? rootY;

      const dx = px - rootX;
      const dy = py - rootY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = len > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
      // Ghost nodes drift gently; circle nodes burst outward to their orbital
      const speed = isGhost ? 2 : 10 + Math.random() * 4;

      return {
        id: node.id,
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        fx: null,
        fy: null,
        depth,
        isRoot: false,
        isGhost,
      };
    });

    simNodesRef.current = newSimNodes;

    // Sync posMap with latest sim positions
    newSimNodes.forEach((n) => {
      if (!posMapRef.current.has(n.id)) {
        posMapRef.current.set(n.id, { x: n.x, y: n.y });
      }
    });
    // Remove stale positions
    posMapRef.current.forEach((_, id) => {
      if (!newSimNodes.find((n) => n.id === id)) posMapRef.current.delete(id);
    });

    const simLinks = currentEdges.map((e) => ({ source: e.source, target: e.target }));

    const hasNewNodes = newSimNodes.some((n) => !existingIds.has(n.id));

    if (!simRef.current) {
      // First run — create simulation
      const sim = forceSimulation<SimNode>(newSimNodes)
        .force(
          "link",
          forceLink(simLinks as { source: string; target: string }[])
            .id((d) => (d as SimNode).id)
            .distance((link) => {
              const tid =
                typeof link.target === "object"
                  ? (link.target as SimNode).id
                  : (link.target as string);
              return nodesRef.current.find((n) => n.id === tid)?.type === "ghost" ? 40 : 25;
            })
            .strength((link) => {
              const tid =
                typeof link.target === "object"
                  ? (link.target as SimNode).id
                  : (link.target as string);
              return nodesRef.current.find((n) => n.id === tid)?.type === "ghost" ? 0.9 : 0.08;
            })
        )
        .force(
          "charge",
          forceManyBody<SimNode>().strength((d) => {
            if ((d as SimNode).isGhost) return -25;
            return (d as SimNode).isRoot ? -60 : -500;
          })
        )
        // Pull each node to orbitalRadius(depth) away from the root's live position
        .force("orbital", (alpha: number) => {
          const root = simNodesRef.current.find((n) => n.isRoot);
          if (!root) return;
          const rx = root.x, ry = root.y;
          for (const n of simNodesRef.current) {
            if (n.isRoot || n.isGhost) continue;
            const dx = n.x - rx;
            const dy = n.y - ry;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const target = orbitalRadius(n.depth);
            // Floor prevents the force from scaling to ~zero at idle alpha (0.008).
            // forceCollide runs at full strength regardless of alpha, so without
            // the floor it easily wins and nodes drift off their rings.
            const k = Math.max(0.2, alpha) * 4.0 * (target - dist) / dist;
            n.vx += dx * k;
            n.vy += dy * k;
          }
        })
        .force(
          "collision",
          forceCollide<SimNode>((d) => (d as SimNode).isGhost ? 10 : 60).strength(1.0)
        )
        // Tangential drift relative to root so nodes float along their orbital
        .force("tangential", (alpha: number) => {
          const root = simNodesRef.current.find((n) => n.isRoot);
          if (!root) return;
          // Idle floor: at alphaTarget (~0.008) the physics term nearly vanishes,
          // so the floor takes over and keeps a constant barely-perceptible drift.
          // During interaction alpha rises (0.3–0.6) and physics eclipses the floor.
          const strength = Math.max(0.04, 0.18 * alpha);
          for (const n of simNodesRef.current) {
            if (n.isRoot || n.isGhost) continue;
            const dx = n.x - root.x;
            const dy = n.y - root.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < 1) continue;
            n.vx += (-dy / r) * strength;
            n.vy += ( dx / r) * strength;
          }
        })
        .velocityDecay(0.48)
        .alphaDecay(0.012)
        .alphaTarget(0.008)
        .alpha(1);

      sim.on("tick", () => {
        let changed = false;
        simNodesRef.current.forEach((n) => {
          const prev = posMapRef.current.get(n.id);
          const nx = n.x ?? 0;
          const ny = n.y ?? 0;
          if (!prev || Math.abs(nx - prev.x) > 0.08 || Math.abs(ny - prev.y) > 0.08) {
            posMapRef.current.set(n.id, { x: nx, y: ny });
            changed = true;
          }
        });
        if (changed) dirtyRef.current = true;
      });

      simRef.current = sim;
    } else {
      // Update existing simulation
      const sim = simRef.current;
      sim.nodes(newSimNodes);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lf = sim.force("link") as any;
      if (lf) lf.links(simLinks);

      if (hasNewNodes) {
        sim.alpha(Math.max(sim.alpha(), 0.6));
      }
    }

    dirtyRef.current = true;
    startLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds, edgeIds, startLoop]);

  // rfNodes already has D3-driven positions. Augment with active/pending state.
  const displayNodes = rfNodes.map((n) => {
    if (n.type === "circle") return { ...n, data: { ...n.data, isActive: n.id === activeNodeId } };
    if (n.type === "ghost") return { ...n, data: { ...n.data, isPending: n.id === pendingGhostId } };
    return n;
  });

  // Collect unique depths of occupied orbitals (circle nodes only, excluding root)
  const occupiedDepths = Array.from(
    new Set(
      nodes
        .filter((n) => n.type === "circle" && (n.data as { depth?: number }).depth! > 0)
        .map((n) => (n.data as { depth: number }).depth)
    )
  ).sort((a, b) => a - b);

  // Root's current position in graph space — orbitals are centered here
  const rootRfNode = rfNodes.find((n) => !!(n.data as { isRoot?: boolean }).isRoot);
  const rootPos = rootRfNode?.position ?? { x: 0, y: 0 };

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onNodeClick(node.id, node.type ?? "circle", node.data as Record<string, unknown>);
  };

  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      isDraggingRef.current = true;
      const sn = simNodesRef.current.find((n) => n.id === node.id);
      if (sn) {
        sn.fx = node.position.x;
        sn.fy = node.position.y;
      }
      simRef.current?.alphaTarget(0.3).alpha(0.3).restart();
      startLoop();
    },
    [startLoop]
  );

  const handleNodeDrag: OnNodeDrag = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      const sn = simNodesRef.current.find((n) => n.id === node.id);
      if (sn) {
        sn.fx = node.position.x;
        sn.fy = node.position.y;
        sn.x = node.position.x;
        sn.y = node.position.y;
        posMapRef.current.set(node.id, { x: node.position.x, y: node.position.y });
        dirtyRef.current = true;
      }
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      isDraggingRef.current = false;
      const sn = simNodesRef.current.find((n) => n.id === node.id);
      if (sn) {
        if (sn.isRoot) {
          // Pin root at drop position so the whole system stays where placed
          sn.fx = sn.x;
          sn.fy = sn.y;
          sn.vx = 0;
          sn.vy = 0;
        } else {
          sn.fx = null;
          sn.fy = null;
          const angle = Math.random() * Math.PI * 2;
          sn.vx = Math.cos(angle) * (2 + Math.random() * 2);
          sn.vy = Math.sin(angle) * (2 + Math.random() * 2);
        }
      }
      simRef.current?.alphaTarget(0.008).alpha(0.4).restart();
      startLoop();
    },
    [startLoop]
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        onNodesChange={handleRfNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
        zoomOnDoubleClick={false}
        minZoom={0.15}
        maxZoom={4}
      >
        <CameraController
          activeNodeId={activeNodeId}
          fitViewTrigger={fitViewTrigger}
        />
        <OrbitalRings occupiedDepths={occupiedDepths} rootPos={rootPos} />
        <Panel position="bottom-right">
          <FitViewButton />
        </Panel>
      </ReactFlow>
    </div>
  );
}
