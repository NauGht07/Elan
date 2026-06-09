import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  const { topic } = await request.json();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are a topic disambiguation assistant. Given a topic that could be interpreted in multiple ways, return 2 to 4 distinct interpretations. Respond with a JSON object in this exact shape: { "interpretations": [{ "label": string, "description": string }] }. Each label should be the topic name with a clarifying parenthetical (e.g. "Transformers (Neural Networks)"). Keep descriptions to one sentence.',
      },
      { role: "user", content: topic },
    ],
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);
  return Response.json(parsed.interpretations ?? []);
}
