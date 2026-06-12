"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { type Node, type Edge } from "@xyflow/react";
import GraphPanel from "./components/GraphPanel";
import { logout } from "./actions/auth";

type NodeData = {
  topic: string;
  summary: string;
  brief: string;
  subtopics: string[];
};

type GhostNodeData = {
  label: string;
  parentId: string;
  depth: number;
};

type TreeRecord = {
  id: string;
  topic: string;
  created_at: string;
};

type DBNode = {
  id: string;
  tree_id: string;
  parent_id: string | null;
  topic: string;
  summary: string;
  brief: string;
  subtopics: string[];
  notes?: string;
  ancestor_ids: string[];
  depth: number;
  query: string;
};

type PreviewState =
  | { status: "loading"; subtopic: string; parentId: string; ghostNodeId: string | null }
  | { status: "ready"; subtopic: string; parentId: string; nodeData: NodeData; ghostNodeId: string | null };

const GHOST_SIZE = 10;
const CIRCLE_SIZE = 13;
const ROOT_SIZE = 22;

const nodeWrapperStyle = (size: number) => ({
  background: "transparent",
  border: "none",
  padding: 0,
  width: size,
  height: size,
});

const ghostWrapperStyle = {
  background: "transparent",
  border: "none",
  padding: 0,
  width: GHOST_SIZE,
  height: GHOST_SIZE,
};

function layoutRadial(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Build adjacency for circle nodes only
  const children: Record<string, string[]> = {};
  const hasParent = new Set<string>();
  for (const n of nodes) if (n.type === "circle") children[n.id] = [];
  for (const e of edges) {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    if (s?.type === "circle" && t?.type === "circle") {
      children[e.source]?.push(e.target);
      hasParent.add(e.target);
    }
  }

  const root = nodes.find((n) => n.type === "circle" && !hasParent.has(n.id));
  if (!root) return nodes;

  const pos: Record<string, { x: number; y: number }> = { [root.id]: { x: 0, y: 0 } };
  const STEP = 160;

  // Subtree leaf count for proportional angle allocation
  const leafCount: Record<string, number> = {};
  function count(id: string): number {
    const ch = children[id] ?? [];
    leafCount[id] = ch.length === 0 ? 1 : ch.reduce((s, c) => s + count(c), 0);
    return leafCount[id];
  }
  count(root.id);

  // Recursively place children in the angular wedge [a0, a1]
  function place(id: string, a0: number, a1: number, d: number) {
    const ch = children[id] ?? [];
    if (!ch.length) return;
    const total = ch.reduce((s, c) => s + (leafCount[c] ?? 1), 0);
    let a = a0;
    for (const cid of ch) {
      const span = ((leafCount[cid] ?? 1) / total) * (a1 - a0);
      const mid = a + span / 2;
      pos[cid] = { x: (d + 1) * STEP * Math.cos(mid), y: (d + 1) * STEP * Math.sin(mid) };
      place(cid, a, a + span, d + 1);
      a += span;
    }
  }

  place(root.id, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  // Place ghost nodes around their parent
  const ghostsByParent: Record<string, string[]> = {};
  for (const n of nodes) {
    if (n.type === "ghost") {
      const d = n.data as unknown as GhostNodeData;
      (ghostsByParent[d.parentId] ??= []).push(n.id);
    }
  }
  const GHOST_R = 56;
  for (const [pid, gids] of Object.entries(ghostsByParent)) {
    const pp = pos[pid] ?? { x: 0, y: 0 };
    const n = gids.length;
    gids.forEach((gid, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pos[gid] = { x: pp.x + GHOST_R * Math.cos(angle), y: pp.y + GHOST_R * Math.sin(angle) };
    });
  }

  return nodes.map((n) => ({ ...n, position: pos[n.id] ?? n.position }));
}

type SummarySegment =
  | { type: "text"; content: string }
  | { type: "inline"; math: string }
  | { type: "block"; math: string };

function parseSummaryChunk(chunk: string): SummarySegment[] {
  const segments: SummarySegment[] = [];
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\n$][\s\S]*?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(chunk)) !== null) {
    const before = chunk.slice(lastIndex, match.index);
    if (before) segments.push({ type: "text", content: before });

    const token = match[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      segments.push({ type: "block", math: token.slice(2, -2).trim() });
    } else {
      segments.push({ type: "inline", math: token.slice(1, -1).trim() });
    }
    lastIndex = match.index + token.length;
  }

  const rest = chunk.slice(lastIndex);
  if (rest) segments.push({ type: "text", content: rest });
  return segments;
}

function renderSummaryChunk(chunk: string, index: number) {
  const segments = parseSummaryChunk(chunk);
  const hasBlock = segments.some((s) => s.type === "block");

  if (!hasBlock) {
    return (
      <p key={index} className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
        {segments.map((s, i) => {
          if (s.type === "text") return <span key={i}>{s.content}</span>;
          return <InlineMath key={i} math={s.math} />;
        })}
      </p>
    );
  }

  const children: ReactNode[] = [];
  let paragraphNodes: ReactNode[] = [];

  const flushParagraph = () => {
    if (paragraphNodes.length > 0) {
      children.push(
        <p key={`p-${children.length}`} className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
          {paragraphNodes}
        </p>
      );
      paragraphNodes = [];
    }
  };

  segments.forEach((s, i) => {
    if (s.type === "block") {
      flushParagraph();
      children.push(<BlockMath key={`block-${i}`} math={s.math} />);
    } else if (s.type === "inline") {
      paragraphNodes.push(<InlineMath key={`inline-${i}`} math={s.math} />);
    } else {
      paragraphNodes.push(<span key={`text-${i}`}>{s.content}</span>);
    }
  });
  flushParagraph();

  return (
    <div key={index} className="space-y-4 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
      {children}
    </div>
  );
}

type SummaryBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "step"; n: number; text: string };

function splitSummaryBlocks(summary: string): SummaryBlock[] {
  // Push inline numbered items onto their own lines before splitting
  const normalized = summary.replace(/ (\d+\.) /g, "\n$1 ");
  const blocks: SummaryBlock[] = [];
  for (const chunk of normalized.split("\n\n")) {
    const lines = chunk.split("\n");
    const hasNumbered = lines.some((l) => /^\d+\.\s/.test(l));
    if (!hasNumbered) {
      if (chunk.trim()) blocks.push({ kind: "paragraph", text: chunk });
      continue;
    }
    let proseBuf: string[] = [];
    for (const line of lines) {
      const m = line.match(/^(\d+)\.\s+([\s\S]*)/);
      if (m) {
        if (proseBuf.length) {
          blocks.push({ kind: "paragraph", text: proseBuf.join("\n") });
          proseBuf = [];
        }
        blocks.push({ kind: "step", n: parseInt(m[1], 10), text: m[2] });
      } else {
        proseBuf.push(line);
      }
    }
    if (proseBuf.length) blocks.push({ kind: "paragraph", text: proseBuf.join("\n") });
  }
  return blocks;
}

function renderSummaryBlock(block: SummaryBlock, index: number) {
  if (block.kind === "paragraph") return renderSummaryChunk(block.text, index);
  const segments = parseSummaryChunk(block.text);
  return (
    <div key={index} className="flex gap-3 items-baseline">
      <span className="flex-shrink-0 w-5 text-right text-xs font-bold leading-6 text-violet-500 dark:text-violet-400">
        {block.n}.
      </span>
      <p className="flex-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
        {segments.map((s, i) => {
          if (s.type === "text") return <span key={i}>{s.content}</span>;
          if (s.type === "block") return <BlockMath key={i} math={s.math} />;
          return <InlineMath key={i} math={s.math} />;
        })}
      </p>
    </div>
  );
}

function makeGhosts(parentId: string, subtopics: string[], parentDepth: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = subtopics.map((sub, i) => ({
    id: `ghost-${parentId}-${i}`,
    type: "ghost",
    position: { x: 0, y: 0 },
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    data: { label: sub, parentId, depth: parentDepth + 1 } as unknown as Record<string, unknown>,
    style: ghostWrapperStyle,
  }));
  const edges: Edge[] = nodes.map((gn) => ({
    id: `${gn.id}-edge`,
    source: parentId,
    target: gn.id,
    style: { stroke: "#71717a", strokeWidth: 1, opacity: 0.3, strokeDasharray: "4 3" },
  }));
  return { nodes, edges };
}

function reconstructGraph(dbNodes: DBNode[]): { nodes: Node[]; edges: Edge[] } {
  const childrenByParent: Record<string, DBNode[]> = {};
  for (const n of dbNodes) {
    if (n.parent_id) {
      (childrenByParent[n.parent_id] ??= []).push(n);
    }
  }

  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];

  for (const dbNode of dbNodes) {
    const isRoot = dbNode.parent_id === null;
    const size = isRoot ? ROOT_SIZE : CIRCLE_SIZE;
    allNodes.push({
      id: dbNode.id,
      type: "circle",
      position: { x: 0, y: 0 },
      width: size,
      height: size,
      data: {
        label: dbNode.topic,
        size,
        isRoot,
        depth: dbNode.depth,
        query: dbNode.query ?? "",
        nodeData: {
          topic: dbNode.topic,
          summary: dbNode.summary,
          brief: dbNode.brief,
          subtopics: dbNode.subtopics,
        },
      },
      style: nodeWrapperStyle(size),
    });

    if (dbNode.parent_id) {
      allEdges.push({
        id: `edge-${dbNode.parent_id}-${dbNode.id}`,
        source: dbNode.parent_id,
        target: dbNode.id,
        style: { stroke: "#71717a", strokeWidth: 1 },
      });
    }

  }

  const laid = layoutRadial(allNodes, allEdges);
  return { nodes: laid, edges: allEdges };
}

export default function Home() {
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isDisambiguating, setIsDisambiguating] = useState(false);
  const [disambiguationOptions, setDisambiguationOptions] = useState<
    { label: string; description: string }[] | null
  >(null);

  const [sidebarHovered, setSidebarHovered] = useState(false);

  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [activeNodeData, setActiveNodeData] = useState<NodeData | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [notes, setNotes] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [nodeDeleteConfirm, setNodeDeleteConfirm] = useState(false);
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [confirmDeleteTreeId, setConfirmDeleteTreeId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ghost nodes exist only for the currently active node
  const { nodes: activeGhostNodes, edges: activeGhostEdges } = useMemo(() => {
    if (!activeNodeId) return { nodes: [], edges: [] };
    const activeNode = graphNodes.find((n) => n.id === activeNodeId);
    if (!activeNode || activeNode.type !== "circle") return { nodes: [], edges: [] };
    const nodeData = (activeNode.data as { nodeData: NodeData }).nodeData;
    const exploredLabels = new Set(
      graphEdges
        .filter((e) => e.source === activeNodeId)
        .map((e) => graphNodes.find((n) => n.id === e.target))
        .filter((n): n is Node => n?.type === "circle")
        .map((n) => (n.data as { label: string }).label.toLowerCase())
    );
    const unexplored = nodeData.subtopics.filter((s) => !exploredLabels.has(s.toLowerCase()));
    const depth = (activeNode.data as { depth: number }).depth ?? 0;
    return makeGhosts(activeNodeId, unexplored, depth);
  }, [activeNodeId, graphNodes, graphEdges]);

  const drawerOpen = previewState !== null || activeNodeData !== null;

  useEffect(() => {
    setCustomTopic("");
  }, [activeNodeId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [notes]);

  useEffect(() => {
    fetch("/api/trees")
      .then((r) => r.json())
      .then((data: TreeRecord[]) => setTrees(data))
      .catch(() => {})
      .finally(() => setIsLoadingTrees(false));
  }, []);

  async function loadTree(treeId: string) {
    setIsLoadingGraph(true);
    setGraphNodes([]);
    setGraphEdges([]);
    setActiveNodeData(null);
    setActiveNodeId(null);
    setNodeDeleteConfirm(false);
    try {
      const res = await fetch(`/api/nodes?tree_id=${treeId}`);
      if (!res.ok) return;
      const dbNodes: DBNode[] = await res.json();
      const { nodes, edges } = reconstructGraph(dbNodes);
      setGraphNodes(nodes);
      setGraphEdges(edges);
      const root = dbNodes.find((n) => n.depth === 0);
      if (root) {
        setActiveNodeData({ topic: root.topic, summary: root.summary, brief: root.brief, subtopics: root.subtopics });
        setActiveNodeId(root.id);
        setNotes(root.notes ?? "");
      }
    } finally {
      setIsLoadingGraph(false);
    }
  }

  async function handleTreeSelect(tree: TreeRecord) {
    if (activeTreeId === tree.id) return;
    abortRef.current?.abort();
    setPreviewState(null);
    setActiveTreeId(tree.id);
    await loadTree(tree.id);
  }

  async function handleDisambiguate() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setIsDisambiguating(true);
    try {
      const res = await fetch("/api/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const options: { label: string; description: string }[] = await res.json();
      setDisambiguationOptions(options);
    } finally {
      setIsDisambiguating(false);
    }
  }

  async function handleAdd(chosenLabel: string) {
    const originalInput = inputValue.trim();
    setInputValue("");
    setDisambiguationOptions(null);
    setShowModal(false);

    const res = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: chosenLabel, originalInput }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      setApiError(error ?? "Failed to create topic");
      return;
    }
    const raw = (await res.json()) as NodeData & { tree_id: string; node_id: string };
    const { tree_id, node_id, ...nodeData } = raw;

    setTrees((prev) => [
      { id: tree_id, topic: nodeData.topic, created_at: new Date().toISOString() },
      ...prev,
    ]);
    setActiveTreeId(tree_id);

    const rootNode: Node = {
      id: node_id,
      type: "circle",
      position: { x: 0, y: 0 },
      width: ROOT_SIZE,
      height: ROOT_SIZE,
      data: { label: nodeData.topic, size: ROOT_SIZE, isRoot: true, depth: 0, query: originalInput, nodeData },
      style: nodeWrapperStyle(ROOT_SIZE),
    };

    setGraphNodes([rootNode]);
    setGraphEdges([]);
    setActiveNodeData(nodeData);
    setActiveNodeId(node_id);
    setNotes("");
  }

  async function startPreview(subtopic: string, parentId: string) {
    if (
      previewState?.status === "ready" &&
      previewState.subtopic.toLowerCase() === subtopic.toLowerCase() &&
      previewState.parentId === parentId
    ) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const ghostNode = activeGhostNodes.find(
      (n) =>
        (n.data as unknown as GhostNodeData).parentId === parentId &&
        (n.data as unknown as GhostNodeData).label.toLowerCase() === subtopic.toLowerCase()
    );

    setPreviewState({ status: "loading", subtopic, parentId, ghostNodeId: ghostNode?.id ?? null });

    try {
      const briefs: string[] = [];
      let ancestorId: string | null = parentId;
      while (ancestorId) {
        const node = graphNodes.find((n) => n.id === ancestorId && n.type === "circle");
        if (!node) break;
        briefs.unshift((node.data as { nodeData: NodeData }).nodeData.brief);
        ancestorId = graphEdges.find((e) => e.target === ancestorId)?.source ?? null;
      }

      const rootNode = graphNodes.find((n) => !!(n.data as { isRoot?: boolean }).isRoot);
      const query = (rootNode?.data as { query?: string })?.query ?? "";

      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: subtopic, brief_list: briefs, query }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (!res.ok) {
        setPreviewState(null);
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        setApiError(error ?? "Failed to load preview");
        return;
      }

      const nodeData: NodeData = await res.json();
      if (controller.signal.aborted) return;

      setPreviewState({ status: "ready", subtopic, parentId, nodeData, ghostNodeId: ghostNode?.id ?? null });
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
      setPreviewState(null);
      setApiError("Failed to load preview");
    }
  }

  async function handleAddToGraph() {
    if (previewState?.status !== "ready" || !activeTreeId) return;
    const { subtopic, parentId, nodeData, ghostNodeId } = previewState;

    setIsExpanding(true);
    setPreviewState(null);

    const rootNode = graphNodes.find((n) => !!(n.data as { isRoot?: boolean }).isRoot);
    const query = (rootNode?.data as { query?: string })?.query ?? "";

    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: subtopic, parent_id: parentId, tree_id: activeTreeId, nodeData, query }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        setApiError(error ?? "Failed to add to graph");
        return;
      }

      const { node_id: newId } = await res.json();

      const parentDepth = ((graphNodes.find((n) => n.id === parentId)?.data as { depth?: number })?.depth) ?? 0;
      const newDepth = parentDepth + 1;

      const newNode: Node = {
        id: newId,
        type: "circle",
        position: { x: 0, y: 0 },
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        data: { label: nodeData.topic, size: CIRCLE_SIZE, depth: newDepth, query, nodeData },
        style: nodeWrapperStyle(CIRCLE_SIZE),
      };

      const realEdge: Edge = {
        id: `edge-${parentId}-${newId}`,
        source: parentId,
        target: newId,
      };

      const updatedNodes = [...graphNodes, newNode];
      const updatedEdges = [...graphEdges, realEdge];

      setGraphNodes(layoutRadial(updatedNodes, updatedEdges));
      setGraphEdges(updatedEdges);
      setActiveNodeData(nodeData);
      setActiveNodeId(newId);
      setNotes("");
    } finally {
      setIsExpanding(false);
    }
  }

  function handleCustomTopicSubmit() {
    const trimmed = customTopic.trim();
    if (!trimmed || isExpanding) return;
    setCustomTopic("");
    handleSubtopicClick(trimmed);
  }

  function handleSubtopicClick(subtopic: string) {
    if (!activeNodeId || isExpanding) return;

    const existing = graphNodes.find(
      (n) =>
        n.type === "circle" &&
        (n.data as { label: string }).label.toLowerCase() === subtopic.toLowerCase()
    );
    if (existing) {
      abortRef.current?.abort();
      setPreviewState(null);
      setActiveNodeId(existing.id);
      setActiveNodeData((existing.data as { nodeData: NodeData }).nodeData);
      setNotes((existing.data as { notes?: string }).notes ?? "");
      return;
    }

    startPreview(subtopic, activeNodeId);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    if (activeNodeId) {
      setGraphNodes((prev) =>
        prev.map((n) => n.id === activeNodeId ? { ...n, data: { ...(n.data as object), notes: value } } : n)
      );
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      notesTimerRef.current = setTimeout(() => {
        fetch("/api/nodes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id: activeNodeId, notes: value }),
        }).catch(() => {});
      }, 500);
    }
  }

  function handleDismissDrawer() {
    abortRef.current?.abort();
    setPreviewState(null);
    setActiveNodeData(null);
    setActiveNodeId(null);
    setNodeDeleteConfirm(false);
  }

  async function handleDeleteNode() {
    if (!activeNodeId || !activeTreeId) return;
    setIsDeletingNode(true);
    try {
      const res = await fetch(`/api/nodes?node_id=${activeNodeId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Delete failed" }));
        setApiError(error);
        return;
      }
      setPreviewState(null);
      await loadTree(activeTreeId);
    } finally {
      setIsDeletingNode(false);
    }
  }

  async function handleDeleteTree(treeId: string) {
    const res = await fetch(`/api/trees?tree_id=${treeId}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Delete failed" }));
      setApiError(error);
      return;
    }
    setConfirmDeleteTreeId(null);
    setTrees((prev) => prev.filter((t) => t.id !== treeId));
    if (activeTreeId === treeId) {
      setActiveTreeId(null);
      setGraphNodes([]);
      setGraphEdges([]);
      setActiveNodeData(null);
      setActiveNodeId(null);
      setPreviewState(null);
    }
  }

  function handleGraphNodeClick(id: string, nodeType: string, data: Record<string, unknown>) {
    if (nodeType === "circle") {
      abortRef.current?.abort();
      setPreviewState(null);
      setNodeDeleteConfirm(false);
      setActiveNodeId(id);
      setActiveNodeData((data as { nodeData: NodeData }).nodeData);
      setNotes((data as { notes?: string }).notes ?? "");
    } else if (nodeType === "ghost") {
      const ghost = data as unknown as GhostNodeData;
      const parentCircle = graphNodes.find((n) => n.id === ghost.parentId && n.type === "circle");
      if (parentCircle) {
        setActiveNodeId(parentCircle.id);
        setActiveNodeData((parentCircle.data as { nodeData: NodeData }).nodeData);
        setNotes((parentCircle.data as { notes?: string }).notes ?? "");
      }
      startPreview(ghost.label, ghost.parentId);
    }
  }

  const activeIsRoot = graphNodes.some(
    (n) => n.id === activeNodeId && !!(n.data as { isRoot?: boolean }).isRoot
  );

  return (
    <>
      {/* Error toast */}
      {apiError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-2.5 rounded-lg shadow-lg">
          <span>{apiError}</span>
          <button
            onClick={() => setApiError(null)}
            className="ml-1 text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Graph — full screen */}
      <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-900">
        <GraphPanel
          nodes={[...graphNodes, ...activeGhostNodes]}
          edges={[...graphEdges, ...activeGhostEdges]}
          activeNodeId={activeNodeId}
          pendingGhostId={previewState?.ghostNodeId ?? null}
          onNodeClick={handleGraphNodeClick}
        />
      </div>

      {/* Graph loading overlay */}
      {isLoadingGraph && (
        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
            Loading…
          </span>
        </div>
      )}

      {/* Left sidebar */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed left-0 top-0 h-screen z-30 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 transition-[width] duration-200 ease-in-out overflow-hidden ${
          sidebarHovered ? "w-64" : "w-12"
        }`}
      >
        {/* Add button */}
        <div className="h-12 flex-shrink-0 flex items-center border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => { setSidebarHovered(false); setShowModal(true); setApiError(null); }}
            className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            title="Add topic"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
          </button>
          {sidebarHovered && (
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap select-none">
              Topics
            </span>
          )}
        </div>

        {/* Topic list */}
        <ul className="flex-1 overflow-y-auto py-1">
          {isLoadingTrees ? (
            <li className="h-9 flex items-center px-3">
              {sidebarHovered && <span className="text-xs text-zinc-400 dark:text-zinc-500">Loading…</span>}
            </li>
          ) : trees.length === 0 ? (
            <li className="h-9 flex items-center px-3">
              {sidebarHovered && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">No topics yet.</span>
              )}
            </li>
          ) : (
            trees.map((tree) => (
              <li key={tree.id}>
                {confirmDeleteTreeId === tree.id ? (
                  <div className="flex items-center h-9 px-3 gap-1.5 bg-red-50 dark:bg-red-950/40">
                    {sidebarHovered ? (
                      <>
                        <span className="flex-1 text-xs text-red-600 dark:text-red-400 truncate">Delete?</span>
                        <button
                          onClick={() => handleDeleteTree(tree.id)}
                          className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline px-1 flex-shrink-0"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTreeId(null)}
                          className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 px-1 flex-shrink-0"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto" />
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center h-9 transition-colors ${
                    activeTreeId === tree.id
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}>
                    <button
                      onClick={() => handleTreeSelect(tree)}
                      className="flex-1 flex items-center gap-3 h-full px-3 min-w-0"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                          activeTreeId === tree.id ? "bg-violet-500" : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      />
                      {sidebarHovered && (
                        <span className="text-sm truncate whitespace-nowrap">{tree.topic}</span>
                      )}
                    </button>
                    {sidebarHovered && (
                      <button
                        onClick={() => setConfirmDeleteTreeId(tree.id)}
                        className="flex-shrink-0 w-7 h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors pr-2"
                        title="Delete tree"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        {/* Sign out */}
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
          <form action={logout}>
            <button
              type="submit"
              className="w-full h-12 flex items-center gap-3 px-3 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h3a2.75 2.75 0 0 1 2.75 2.75v.5a.75.75 0 0 1-1.5 0v-.5c0-.69-.56-1.25-1.25-1.25h-3C4.06 3.5 3.5 4.06 3.5 4.75v6.5c0 .69.56 1.25 1.25 1.25h3c.69 0 1.25-.56 1.25-1.25v-.5a.75.75 0 0 1 1.5 0v.5A2.75 2.75 0 0 1 7.75 14h-3A2.75 2.75 0 0 1 2 11.25v-6.5Zm9.47.47a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H6.75a.75.75 0 0 1 0-1.5h5.69l-.97-.97a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              {sidebarHovered && <span className="text-xs whitespace-nowrap">Sign out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Right drawer */}
      <aside
        className={`fixed right-0 top-0 h-screen w-[420px] max-w-[85vw] z-30 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-l border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate pr-3">
            {trees.find((t) => t.id === activeTreeId)?.topic ?? ""}
          </h2>
          <button
            onClick={handleDismissDrawer}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        {/* Drawer body */}
        {previewState?.status === "loading" ? (
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="h-7 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded-md animate-pulse" />
              <div className="space-y-2 mt-1">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-11/12" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-5/6" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-4/6" />
              </div>
            </div>
          </div>
        ) : previewState?.status === "ready" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {previewState.nodeData.topic}
                </h1>
                <div className="text-sm leading-6 text-zinc-800 dark:text-zinc-200 space-y-4">
                  {splitSummaryBlocks(previewState.nodeData.summary).map(renderSummaryBlock)}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex-shrink-0">
              <button
                onClick={handleAddToGraph}
                disabled={isExpanding}
                className="w-full px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExpanding ? "Adding…" : "Add to Graph"}
              </button>
            </div>
          </div>
        ) : activeNodeData ? (
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {activeNodeData.topic}
              </h1>
              <div className="text-sm leading-6 text-zinc-800 dark:text-zinc-200 space-y-4">
                {splitSummaryBlocks(activeNodeData.summary).map(renderSummaryBlock)}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                Subtopics
              </h3>
              <ul className="flex flex-col gap-1">
                {activeNodeData.subtopics.map((sub, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSubtopicClick(sub)}
                      disabled={isExpanding}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sub}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCustomTopicSubmit(); }}
                  placeholder="Or explore your own direction…"
                  disabled={isExpanding}
                  className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition disabled:opacity-50"
                />
                <button
                  onClick={handleCustomTopicSubmit}
                  disabled={isExpanding || !customTopic.trim()}
                  className="flex-shrink-0 w-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 pb-2">
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                Notes
              </h3>
              <textarea
                ref={textareaRef}
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add notes…"
                rows={3}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none overflow-hidden transition"
              />
            </div>
            {!activeIsRoot && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                {nodeDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-red-500 dark:text-red-400">Delete this node and all sub-topics?</span>
                    <button
                      onClick={handleDeleteNode}
                      disabled={isDeletingNode}
                      className="text-xs text-red-500 dark:text-red-400 font-medium hover:underline disabled:opacity-50 flex-shrink-0"
                    >
                      {isDeletingNode ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setNodeDeleteConfirm(false)}
                      className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setNodeDeleteConfirm(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                    </svg>
                    Delete node
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </aside>

      {/* Add topic modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setShowModal(false);
            setDisambiguationOptions(null);
            setInputValue("");
          }}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {disambiguationOptions === null ? (
              <>
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                  What do you want to dive into next?
                </h3>
                <input
                  autoFocus
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDisambiguate()}
                  placeholder="e.g. Transformers, Recursion…"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setInputValue("");
                    }}
                    className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisambiguate}
                    disabled={isDisambiguating || !inputValue.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDisambiguating ? "Thinking…" : "Next"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDisambiguationOptions(null)}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                    Which did you mean?
                  </h3>
                </div>
                <ul className="flex flex-col gap-2">
                  {disambiguationOptions.map((opt) => (
                    <li key={opt.label}>
                      <button
                        onClick={() => handleAdd(opt.label)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex flex-col gap-0.5"
                      >
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {opt.label}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {opt.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
