export type NodeType = 'factual' | 'practical';

export interface Interpretation {
  label: string;
  query: string;
  type: NodeType;
}

export type InterpretationResult = { interpretations: Interpretation[] };

export interface Source {
  url: string;
  title: string;
  content: string;
}

export interface Tree {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ElanNode {
  id: string;
  tree_id: string;
  parent_id: string | null;
  ancestor_ids: string[];
  depth: number;
  type: NodeType;
  original_query: string;
  content: string;
  sources: Source[];
  created_at: string;
}

export interface NodeChat {
  id: string;
  node_id: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
}

export interface AncestorContext {
  topic: string;
  type: NodeType;
  content: string;
}

export interface PipelineResult {
  type: NodeType;
  content: string;
  sources: Source[];
  suggestions: { topic: string; type: NodeType }[];
}

export interface Suggestion {
  id: string;
  node_id: string;
  topic: string;
  type: NodeType;
}

export interface Annotation {
  id: string;
  node_id: string;
  text: string;
  anchor_type: 'node' | 'highlight';
  anchor_start: number | null;
  anchor_end: number | null;
  created_at: string;
}
