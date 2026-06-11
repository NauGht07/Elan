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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trees")
    .select("id, topic, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const { topic, originalInput } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const template = process.env.USER_PROMPT ?? topic;
  const promptData = { topic: `${originalInput} (${topic})`, brief_list: "" };
  const userMessage = template.replace(
    /{(\w+)}/g,
    (_: string, key: string) => String(promptData[key as keyof typeof promptData] ?? "")
  );

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = parseContent(completion.choices[0].message.content ?? "{}") as { topic?: string; summary?: string; brief?: string; subtopics?: string[] };
  const nodeTopic = raw.topic ?? "";
  const nodeSummary = raw.summary ?? "";
  const nodeBrief = raw.brief ?? "";
  const nodeSubtopics = raw.subtopics ?? [];

  const { data: tree, error: treeError } = await supabase
    .from("trees")
    .insert({ user_id: user.id, topic: nodeTopic })
    .select("id")
    .single();

  if (treeError) return Response.json({ error: treeError.message }, { status: 500 });

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .insert({
      tree_id: tree.id,
      parent_id: null,
      topic: nodeTopic,
      summary: nodeSummary,
      brief: nodeBrief,
      subtopics: nodeSubtopics,
      ancestor_ids: [],
      depth: 0,
    })
    .select("id")
    .single();

  if (nodeError) return Response.json({ error: nodeError.message }, { status: 500 });

  return Response.json({ topic: nodeTopic, summary: nodeSummary, brief: nodeBrief, subtopics: nodeSubtopics, tree_id: tree.id, node_id: node.id });
}

export async function DELETE(request: NextRequest) {
  const tree_id = new URL(request.url).searchParams.get("tree_id");
  if (!tree_id) return Response.json({ error: "tree_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tree } = await supabase.from("trees").select("user_id").eq("id", tree_id).single();
  if (!tree || tree.user_id !== user.id) return Response.json({ error: "Unauthorized" }, { status: 403 });

  await supabase.from("nodes").delete().eq("tree_id", tree_id);

  const { error } = await supabase.from("trees").delete().eq("id", tree_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
