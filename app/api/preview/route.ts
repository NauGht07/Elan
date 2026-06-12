import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groqJsonCall } from "@/lib/groq";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "";

export async function POST(request: NextRequest) {
  const { topic, brief_list = [], query = "" } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

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

  type Source = { title: string; url: string };
  let raw: { topic?: string; summary?: string; brief?: string; subtopics?: string[]; sources?: Source[] };
  try {
    raw = await groqJsonCall(groq, "llama-3.3-70b-versatile", [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ]) as typeof raw;
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
  return Response.json({
    topic: raw.topic ?? "",
    summary: raw.summary ?? "",
    brief: raw.brief ?? "",
    subtopics: raw.subtopics ?? [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
  });
}
