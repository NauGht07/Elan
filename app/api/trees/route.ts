import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "";

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
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const nodeData = JSON.parse(completion.choices[0].message.content ?? "{}");

  const { data: tree, error: treeError } = await supabase
    .from("trees")
    .insert({ user_id: user.id, topic: nodeData.topic })
    .select("id")
    .single();

  if (treeError) return Response.json({ error: treeError.message }, { status: 500 });

  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .insert({
      tree_id: tree.id,
      parent_id: null,
      topic: nodeData.topic,
      summary: nodeData.summary,
      brief: nodeData.brief,
      subtopics: nodeData.subtopics,
      ancestor_ids: [],
      depth: 0,
    })
    .select("id")
    .single();

  if (nodeError) return Response.json({ error: nodeError.message }, { status: 500 });

  return Response.json({ ...nodeData, tree_id: tree.id, node_id: node.id });
}
