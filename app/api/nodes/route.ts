import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "";

function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return {};
  }
}

export async function GET(request: NextRequest) {
  const tree_id = new URL(request.url).searchParams.get("tree_id");
  if (!tree_id) return Response.json({ error: "tree_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .eq("tree_id", tree_id)
    .order("depth", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const { topic, parent_id, tree_id, brief_list = [], nodeData: preGenerated, query: requestQuery } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: parentNode } = await supabase
    .from("nodes")
    .select("ancestor_ids, depth, query")
    .eq("id", parent_id)
    .single();

  // Propagate query from parent if caller didn't supply it
  const query: string = requestQuery ?? parentNode?.query ?? "";

  let nodeData: { topic: string; summary: string; brief: string; subtopics: string[] };

  if (preGenerated) {
    const p = preGenerated as { topic?: string; summary?: string; brief?: string; subtopics?: string[] };
    nodeData = {
      topic: p.topic ?? "",
      summary: p.summary ?? "",
      brief: p.brief ?? "",
      subtopics: p.subtopics ?? [],
    };
  } else {
    const template = process.env.USER_PROMPT ?? topic;
    const briefs: string[] = (Array.isArray(brief_list) ? brief_list : []).slice(-8);
    const promptData = { topic, brief_list: briefs.length > 0 ? briefs.join("\n- ") : "" };
    const baseMessage = template.replace(
      /{(\w+)}/g,
      (_: string, key: string) => String(promptData[key as keyof typeof promptData] ?? "")
    );
    const userMessage = query
      ? `[User's original question: "${query}"]\n\n${baseMessage}`
      : baseMessage;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = parseContent(completion.choices[0].message.content ?? "{}") as { topic?: string; summary?: string; brief?: string; subtopics?: string[] };
    nodeData = {
      topic: raw.topic ?? "",
      summary: raw.summary ?? "",
      brief: raw.brief ?? "",
      subtopics: raw.subtopics ?? [],
    };
  }

  const ancestorIds: string[] = parentNode
    ? [...parentNode.ancestor_ids, parent_id]
    : [parent_id];
  const depth: number = parentNode ? parentNode.depth + 1 : 1;

  const { data: node, error } = await supabase
    .from("nodes")
    .insert({
      tree_id,
      parent_id,
      topic: nodeData.topic,
      summary: nodeData.summary,
      brief: nodeData.brief,
      subtopics: nodeData.subtopics,
      ancestor_ids: ancestorIds,
      depth,
      query,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ node_id: node.id });
}

export async function PATCH(request: NextRequest) {
  const { node_id, notes } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("nodes").update({ notes }).eq("id", node_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const node_id = new URL(request.url).searchParams.get("node_id");
  if (!node_id) return Response.json({ error: "node_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: node } = await supabase.from("nodes").select("tree_id").eq("id", node_id).single();
  if (!node) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: tree } = await supabase.from("trees").select("user_id").eq("id", node.tree_id).single();
  if (!tree || tree.user_id !== user.id) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { data: allNodes } = await supabase
    .from("nodes")
    .select("id, ancestor_ids")
    .eq("tree_id", node.tree_id);

  const toDelete = (allNodes ?? [])
    .filter((n) => n.id === node_id || (n.ancestor_ids as string[]).includes(node_id))
    .map((n) => n.id);

  const { error } = await supabase.from("nodes").delete().in("id", toDelete);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

