"use client";

import { useState, useRef, useCallback } from "react";
import { type Node, type Edge } from "@xyflow/react";
import GraphPanel from "./components/GraphPanel";

type NodeData = {
  topic: string;
  summary: string;
  brief: string;
  subtopics: string[];
};

type GhostNodeData = {
  label: string;
  parentId: string;
};

const GHOST_SIZE = 12;

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

function nodeSize(childCount: number) {
  return 10 + childCount * 2;
}

function makeGhosts(parentId: string, subtopics: string[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = subtopics.map((sub, i) => ({
    id: `ghost-${parentId}-${i}`,
    type: "ghost",
    position: { x: 0, y: 0 },
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    data: { label: sub, parentId } as unknown as Record<string, unknown>,
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

function layoutTree(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const childMap: Record<string, string[]> = {};
  const hasParent = new Set<string>();

  for (const n of nodes) childMap[n.id] = [];
  for (const e of edges) {
    childMap[e.source]?.push(e.target);
    hasParent.add(e.target);
  }

  const root = nodes.find((n) => !hasParent.has(n.id));
  if (!root) return nodes;

  const depth: Record<string, number> = { [root.id]: 0 };
  const queue: string[] = [root.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of childMap[id] ?? []) {
      depth[child] = depth[id] + 1;
      queue.push(child);
    }
  }

  const levels: Record<number, string[]> = {};
  for (const [id, d] of Object.entries(depth)) {
    (levels[d] ??= []).push(id);
  }

  const X_GAP = 140;
  const Y_GAP = 120;
  const positions: Record<string, { x: number; y: number }> = {};

  for (const [dStr, ids] of Object.entries(levels)) {
    const d = Number(dStr);
    ids.forEach((id, i) => {
      positions[id] = {
        x: (i - (ids.length - 1) / 2) * X_GAP,
        y: d * Y_GAP,
      };
    });
  }

  return nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position }));
}

const MIN_PANEL = 160;

function useResize(initialPx: number) {
  const [width, setWidth] = useState(initialPx);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.preventDefault();

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      setWidth(Math.max(MIN_PANEL, startW.current + delta));
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  return { width, onMouseDown };
}

export default function Home() {
  const [topics, setTopics] = useState(["Introduction", "Core Concepts", "Advanced Topics", "References"]);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isDisambiguating, setIsDisambiguating] = useState(false);
  const [disambiguationOptions, setDisambiguationOptions] = useState<{ label: string; description: string }[] | null>(null);
  const leftResize = useResize(256);
  const rightResize = useResize(320);

  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [activeNodeData, setActiveNodeData] = useState<NodeData | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);

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
    setTopics((prev) => [...prev, chosenLabel]);
    setInputValue("");
    setDisambiguationOptions(null);
    setShowModal(false);

    const res = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: chosenLabel, originalInput }),
    });
    const data: NodeData = await res.json();
    console.log(data);

    const rootId = `node-${Date.now()}`;
    const size = nodeSize(data.subtopics.length);
    const rootNode: Node = {
      id: rootId,
      type: "circle",
      position: { x: 0, y: 0 },
      width: size,
      height: size,
      data: { label: data.topic, size, nodeData: data },
      style: nodeWrapperStyle(size),
    };

    const { nodes: ghostNodes, edges: ghostEdges } = makeGhosts(rootId, data.subtopics);
    const allNodes = [rootNode, ...ghostNodes];

    setGraphNodes(layoutTree(allNodes, ghostEdges));
    setGraphEdges(ghostEdges);
    setActiveNodeData(data);
    setActiveNodeId(rootId);
  }

  async function handleExpandSubtopic(subtopic: string, parentId: string) {
    if (isExpanding) return;
    setIsExpanding(true);

    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: subtopic, parent_id: parentId }),
      });
      const data: NodeData = await res.json();
      console.log(data);

      const newId = `node-${Date.now()}`;
      const size = nodeSize(data.subtopics.length);
      const newNode: Node = {
        id: newId,
        type: "circle",
        position: { x: 0, y: 0 },
        width: size,
        height: size,
        data: { label: data.topic, size, nodeData: data },
        style: nodeWrapperStyle(size),
      };

      const { nodes: newGhostNodes, edges: newGhostEdges } = makeGhosts(newId, data.subtopics);
      const realEdge: Edge = {
        id: `edge-${parentId}-${newId}`,
        source: parentId,
        target: newId,
      };

      // Remove the ghost placeholder for this subtopic (child of parentId)
      const ghostToRemove = graphNodes.find(
        (n) =>
          n.type === "ghost" &&
          (n.data as unknown as GhostNodeData).parentId === parentId &&
          (n.data as unknown as GhostNodeData).label.toLowerCase() === subtopic.toLowerCase()
      );

      const baseNodes = ghostToRemove
        ? graphNodes.filter((n) => n.id !== ghostToRemove.id)
        : graphNodes;
      const baseEdges = ghostToRemove
        ? graphEdges.filter((e) => e.target !== ghostToRemove.id)
        : graphEdges;

      const updatedNodes = [...baseNodes, newNode, ...newGhostNodes];
      const updatedEdges = [...baseEdges, realEdge, ...newGhostEdges];

      setGraphNodes(layoutTree(updatedNodes, updatedEdges));
      setGraphEdges(updatedEdges);
      setActiveNodeData(data);
      setActiveNodeId(newId);
    } finally {
      setIsExpanding(false);
    }
  }

  async function handleSubtopicClick(subtopic: string) {
    if (!activeNodeId || isExpanding) return;

    // Only real nodes count as "already explored"
    const existing = graphNodes.find(
      (n) =>
        n.type === "circle" &&
        (n.data as { label: string }).label.toLowerCase() === subtopic.toLowerCase()
    );
    if (existing) {
      setActiveNodeId(existing.id);
      setActiveNodeData((existing.data as { nodeData: NodeData }).nodeData);
      return;
    }

    await handleExpandSubtopic(subtopic, activeNodeId);
  }

  function handleGraphNodeClick(id: string, nodeType: string, data: Record<string, unknown>) {
    if (nodeType === "circle") {
      setActiveNodeId(id);
      setActiveNodeData((data as { nodeData: NodeData }).nodeData);
    } else if (nodeType === "ghost") {
      const ghost = data as unknown as GhostNodeData;
      handleExpandSubtopic(ghost.label, ghost.parentId);
    }
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {/* Left panel — topic list */}
        <aside
          style={{ width: leftResize.width, minWidth: MIN_PANEL }}
          className="flex-shrink-0 flex flex-col bg-white dark:bg-zinc-800"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
              Topics
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
              </svg>
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {topics.map((topic, i) => (
              <li key={i}>
                <button className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  {topic}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Resize handle: left | center */}
        <div
          onMouseDown={leftResize.onMouseDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors"
        />

        {/* Center panel — node content */}
        <main className="flex-1 flex flex-col bg-white dark:bg-zinc-800 overflow-hidden" style={{ minWidth: MIN_PANEL }}>
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate">
              {activeNodeData ? (
                activeNodeData.topic
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">No node selected</span>
              )}
            </h2>
          </div>
          {activeNodeData ? (
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{activeNodeData.topic}</h1>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activeNodeData.summary}</p>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Subtopics</h3>
                <ul className="flex flex-col gap-1">
                  {activeNodeData.subtopics.map((sub, i) => (
                    <li key={i}>
                      <button
                        onClick={() => handleSubtopicClick(sub)}
                        disabled={isExpanding}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sub}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-600 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <span className="text-sm font-medium">Add a topic to get started</span>
            </div>
          )}
        </main>

        {/* Resize handle: center | right */}
        <div
          onMouseDown={rightResize.onMouseDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors"
        />

        {/* Right panel — graph */}
        <aside
          style={{ width: rightResize.width, minWidth: MIN_PANEL }}
          className="flex-shrink-0 flex flex-col bg-zinc-50 dark:bg-zinc-900"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
              Graph
            </h2>
          </div>
          <GraphPanel
            nodes={graphNodes}
            edges={graphEdges}
            activeNodeId={activeNodeId}
            onNodeClick={handleGraphNodeClick}
          />
        </aside>
      </div>

      {/* Add topic modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowModal(false); setDisambiguationOptions(null); setInputValue(""); }}
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
                    onClick={() => { setShowModal(false); setInputValue(""); }}
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
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{opt.label}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{opt.description}</span>
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
