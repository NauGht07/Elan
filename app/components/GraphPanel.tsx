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

type NodeData = {
  topic: string;
  summary: string;
  brief: string;
  subtopics: string[];
  sources?: { title: string; url: string }[];
};

type CircleNodeData = {
  label: string;
  size: number;
  isActive: boolean;
  nodeData: NodeData;
};

type GhostNodeData = {
  label: string;
  parentId: string;
  isPending?: boolean;
};

function CircleNode({ data }: { data: CircleNodeData }) {
  const [hovered, setHovered] = useState(false);
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: data.isActive ? "#a78bfa" : "#7c6ff7",
          boxShadow: data.isActive ? "0 0 0 3px rgba(167, 139, 250, 0.35)" : "none",
          transition: "background-color 0.15s ease, box-shadow 0.15s ease",
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

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
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
          transition: "all 0.15s ease",
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
  style: { stroke: "#71717a", strokeWidth: 1 },
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
    <div style={{ flex: 1, width: "100%" }}>
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
