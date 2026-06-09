"use client";

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
};

function CircleNode({ data }: { data: CircleNodeData }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: data.isActive ? "#a78bfa" : "#7c6ff7",
          boxShadow: data.isActive ? "0 0 0 3px rgba(167, 139, 250, 0.35)" : "none",
          transition: "background-color 0.15s ease, box-shadow 0.15s ease",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: 6,
          fontSize: 10,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: data.isActive ? "#a1a1aa" : "#71717a",
          userSelect: "none",
          pointerEvents: "none",
          transition: "color 0.15s ease",
        }}
      >
        {data.label}
      </span>
    </>
  );
}

function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: "transparent",
          border: "1.5px dashed #71717a",
          opacity: 0.5,
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: 6,
          fontSize: 10,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: "#71717a",
          opacity: 0.5,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {data.label}
      </span>
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
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  activeNodeId: string | null;
  onNodeClick: (id: string, nodeType: string, data: Record<string, unknown>) => void;
}) {
  const augmentedNodes = nodes.map((n) =>
    n.type === "circle"
      ? { ...n, data: { ...n.data, isActive: n.id === activeNodeId } }
      : n
  );

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
