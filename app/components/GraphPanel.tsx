"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  applyNodeChanges,
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
  forceX,
  forceY,
  type Simulation,
} from "d3-force";

const KEYFRAMES = `
  @keyframes nodeEnter {
    0%   { opacity: 0; transform: scale(0); }
    60%  { opacity: 1; transform: scale(1.18); }
    78%  { transform: scale(0.94); }
    100% { opacity: 1; transform: scale(1); }
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
  tx: number;  // radial target x from layout
  ty: number;  // radial target y from layout
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

export default function GraphPanel({
  nodes,
  edges,
  activeNodeId,
  pendingGhostId,
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  activeNodeId: string | null;
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

    const newSimNodes: SimNode[] = currentNodes.map((node) => {
      const isRoot = !!(node.data as { isRoot?: boolean }).isRoot;
      const isGhost = node.type === "ghost";
      // Ghost nodes don't go through layoutRadial, so their position is 0,0.
      // Use target 0,0 for them — the link force handles their placement.
      const tx = isGhost ? 0 : (node.position.x ?? 0);
      const ty = isGhost ? 0 : (node.position.y ?? 0);

      const existing = prevPosMap.get(node.id);
      if (existing) {
        // Update target positions — layout may have shifted existing nodes
        existing.tx = tx;
        existing.ty = ty;
        existing.isRoot = isRoot;
        existing.isGhost = isGhost;
        if (isRoot) { existing.fx = 0; existing.fy = 0; }
        return existing;
      }

      // Root always starts pinned at center
      if (isRoot) {
        return { id: node.id, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0, tx: 0, ty: 0, isRoot: true, isGhost: false };
      }

      // New non-root node — spawn at parent's current position, burst outward
      const parentEdge = currentEdges.find((e) => e.target === node.id);
      const parentSim = parentEdge ? prevPosMap.get(parentEdge.source) : null;
      const px = parentSim?.x ?? tx;
      const py = parentSim?.y ?? ty;

      const len = Math.sqrt(px * px + py * py);
      const angle = len > 1 ? Math.atan2(py, px) : Math.random() * Math.PI * 2;
      const speed = isGhost ? 3 : 5 + Math.random() * 2;

      return {
        id: node.id,
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        fx: null,
        fy: null,
        tx,
        ty,
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
              return nodesRef.current.find((n) => n.id === tid)?.type === "ghost" ? 0.9 : 0.15;
            })
        )
        .force(
          "charge",
          forceManyBody<SimNode>().strength((d) => {
            if ((d as SimNode).isGhost) return -25;
            return (d as SimNode).isRoot ? -60 : -90;
          })
        )
        // Pull each circle node toward its precomputed radial ring position
        .force(
          "radialX",
          forceX<SimNode>((d) => d.tx).strength((d) => (d.isRoot || d.isGhost) ? 0 : 0.8)
        )
        .force(
          "radialY",
          forceY<SimNode>((d) => d.ty).strength((d) => (d.isRoot || d.isGhost) ? 0 : 0.8)
        )
        .force(
          "collision",
          forceCollide<SimNode>((d) => (d as SimNode).isGhost ? 10 : 18).strength(0.7)
        )
        .velocityDecay(0.45)
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
          // Root stays pinned at center
          sn.fx = 0;
          sn.fy = 0;
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
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
        zoomOnDoubleClick={false}
        minZoom={0.15}
        maxZoom={4}
      />
    </div>
  );
}
