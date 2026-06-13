<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Elan — CLAUDE.md

## What this app is

Elan is an AI-powered recursive learning tree app. Users enter a topic or question,
Elan generates a node with an opinionated summary, and users can explore deeper via
suggested subtopics. The graph animates to reflect the growing knowledge tree.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Supabase (auth + database)
- React Flow (graph rendering)
- Groq API — large model: llama-3.3-70b-versatile
- Groq API — small model: for query rewriting and classification
- Tavily API — live search and sources

## Folder structure — always follow this

/app → pages and routes only
/components → UI components only
/lib → AI pipeline, Tavily, Supabase client, utilities
/types → TypeScript interfaces and types

Never create files outside this structure without asking first.

## Database schema

trees

- id, user_id, title, created_at

nodes

- id, tree_id, parent_id, ancestor_ids (array), depth
- type: "factual" | "practical"
- content, sources (json), created_at
- root nodes are just nodes at depth 0

node_chats

- id, node_id, role ("user" | "assistant"), message, created_at

annotations

- id, node_id, text, created_at

## Node types

Every node is either factual or practical — never both.

- Factual (blue): explanations, facts, history, theory.
- Practical (orange): step-by-step actionable instructions with sources.
  The content format differs significantly between the two —
  the large LLM should structure its response accordingly.
  The large LLM classifies each suggested subtopic as factual or practical
  when generating suggestions. Never hardcode this in the UI logic.

## Suggested subtopics JSON shape

{
"suggestions": [
{ "topic": "string", "type": "factual" | "practical" }
]
}
Color is derived from type in the UI — never stored separately.

## AI pipeline — core loop, never simplify or skip steps

1. Small LLM: rewrite user's conversational input into a clean search query
   - classify the intent
2. Tavily: fetch live sources using the rewritten query
3. Large LLM: generate node content as structured JSON
   - system prompt: loaded from SYSTEM_PROMPT env variable
   - user prompt: loaded from USER_PROMPT env variable
     - inject ancestor chain (structured JSON, format TBD) + Tavily results
4. JSON.parse the response → render as node

## Ancestor context

Pass the full ancestor chain as structured JSON in every LLM call.
Exact format is TBD — do not invent a format. Ask before implementing this.

## Node chat

Each node has its own conversational chat thread.

- Has access to: that node's content + its full ancestor chain
- Does NOT create new nodes
- Purely conversational — for going deeper on the current node

## Annotations

- Attached at node level only
- Plain text only for now
- Stored in DB, displayed alongside the node in the UI

## Rules — read before every action

1. Never start coding without a plan. If a task touches more than one file,
   write the plan first and wait for approval.
2. Never change the database schema without explicitly being told to.
3. Never install a new package without asking first.
4. Keep components small — if a component exceeds 150 lines, split it.
5. Every API route goes in /app/api/
6. All LLM calls go through /lib/ — never call Groq or Tavily directly
   from a component.
7. Never expose API keys — always use environment variables.
8. After completing any task, summarize: what you changed, what files
   were touched, and what to test.
