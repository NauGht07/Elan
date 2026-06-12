import Groq from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";

const MAX_RETRIES = 2;

type GroqMessages = ChatCompletionCreateParamsNonStreaming["messages"];

function tryParseJson(raw: string): Record<string, unknown> | null {
  // 1. Direct parse
  try { return JSON.parse(raw); } catch {}

  // 2. Extract between first { and last }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = raw.slice(first, last + 1);
    try { return JSON.parse(slice); } catch {}

    // 3. Strip newlines from the extracted slice and retry
    const stripped = slice.replace(/[\r\n]/g, " ");
    try { return JSON.parse(stripped); } catch {}
  }

  return null;
}

export async function groqJsonCall(
  groq: Groq,
  model: string,
  messages: GroqMessages,
): Promise<Record<string, unknown>> {
  let lastRaw = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let raw = "";
    try {
      const completion = await groq.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages,
      });
      raw = completion.choices[0].message.content ?? "";
      lastRaw = raw;

      const parsed = tryParseJson(raw);
      if (parsed) return parsed;

      console.error(`[groq] attempt ${attempt + 1}: JSON parse failed. Raw response:\n${raw}`);
    } catch (err) {
      console.error(`[groq] attempt ${attempt + 1}: API call failed:`, err, `\nLast raw: ${lastRaw}`);
    }

    if (attempt < MAX_RETRIES) {
      console.warn(`[groq] retrying (${attempt + 2}/${MAX_RETRIES + 1})…`);
    }
  }

  console.error(`[groq] all ${MAX_RETRIES + 1} attempts failed. Last raw response:\n${lastRaw}`);
  throw new Error("LLM response could not be parsed as JSON after retries");
}
