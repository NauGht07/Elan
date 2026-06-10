"use client";

import { useState } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";

const KEYFRAMES = `
  @keyframes nodeEnter {
    from { opacity: 0; transform: scale(0); }
    to   { opacity: 1; transform: scale(1); }
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

function CircleNode({ data }: { data: CircleNodeData }) {
  const [hovered, setHovered] = useState(false);
  const delay = `${(data.depth ?? 0) * 0.07}s`;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <Handle type="target" position={Position.Top} style={CENTER_HANDLE} />
      <Handle type="source" position={Position.Bottom} style={CENTER_HANDLE} />
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: data.isRoot ? "#a78bfa" : data.isActive ? "#a78bfa" : "#7c6ff7",
          boxShadow: data.isRoot
            ? "0 0 0 3px rgba(167, 139, 250, 0.4), 0 0 12px rgba(167, 139, 250, 0.3)"
            : data.isActive ? "0 0 0 3px rgba(167, 139, 250, 0.35)" : "none",
          animation: `nodeEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay} both`,
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
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: isPending ? "rgba(167, 139, 250, 0.15)" : "transparent",
          border: isPending ? "1.5px solid #a78bfa" : "1.5px dashed #71717a",
          boxShadow: isPending ? "0 0 0 3px rgba(167, 139, 250, 0.2)" : "none",
          opacity: isPending ? 1 : 0.5,
          animation: `nodeEnter 0.4s ease ${delay} both`,
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
    </>
  );
}

const nodeTypes: NodeTypes = {
  circle: CircleNode,
  ghost: GhostNode,
};

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
  const augmentedNodes = nodes.map((n) => {
    if (n.type === "circle") return { ...n, data: { ...n.data, isActive: n.id === activeNodeId } };
    if (n.type === "ghost") return { ...n, data: { ...n.data, isPending: n.id === pendingGhostId } };
    return n;
  });

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onNodeClick(node.id, node.type ?? "circle", node.data as Record<string, unknown>);
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={augmentedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
      />
    </div>
  );
}
