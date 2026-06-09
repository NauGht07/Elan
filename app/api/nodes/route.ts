import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "";

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
  const { topic, parent_id, tree_id, brief_list = [] } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: parentNode } = await supabase
    .from("nodes")
    .select("ancestor_ids, depth")
    .eq("id", parent_id)
    .single();

  const template = process.env.USER_PROMPT ?? topic;
  const briefs: string[] = Array.isArray(brief_list) ? brief_list : [];
  const promptData = { topic, brief_list: briefs.length > 0 ? briefs.join("\n- ") : "" };
  const userMessage = template.replace(
    /{(\w+)}/g,
    (_: string, key: string) => String(promptData[key as keyof typeof promptData] ?? "")
  );

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const nodeData = JSON.parse(completion.choices[0].message.content ?? "{}");

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
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ...nodeData, node_id: node.id });
}
