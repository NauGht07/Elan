import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "";

type Source = { title: string; url: string };

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

function extractSources(message: Groq.Chat.Completions.ChatCompletionMessage): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const tool of (message as { executed_tools?: Groq.Chat.Completions.ChatCompletionMessage.ExecutedTool[] }).executed_tools ?? []) {
    for (const result of tool.search_results?.results ?? []) {
      if (result.url && !seen.has(result.url)) {
        seen.add(result.url);
        sources.push({ title: result.title ?? result.url, url: result.url });
      }
    }
  }
  return sources;
}

export async function POST(request: NextRequest) {
  const { topic, brief_list = [] } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const template = process.env.USER_PROMPT ?? topic;
  const briefs: string[] = Array.isArray(brief_list) ? brief_list : [];
  const promptData = { topic, brief_list: briefs.length > 0 ? briefs.join("\n- ") : "" };
  const userMessage = template.replace(
    /{(\w+)}/g,
    (_: string, key: string) => String(promptData[key as keyof typeof promptData] ?? "")
  );

  const completion = await groq.chat.completions.create({
    model: "compound-beta",
    compound_custom: {
      models: { answering_model: "openai/gpt-oss-120b" },
      tools: { enabled_tools: ["web_search"] },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const message = completion.choices[0].message;
  const nodeData = parseContent(message.content ?? "{}");
  const sources = extractSources(message);
  return Response.json({ ...nodeData, sources });
}
