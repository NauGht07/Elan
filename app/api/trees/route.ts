import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "You are a helpful assistant that generates nodes for a knowledge graph. You will be given a topic and you should return a JSON array of nodes related to that topic. Each node should have the following structure: { id: string, label: string, description: string, parent_id: string | null }. The id should be a unique identifier for the node, the label should be a short name for the node, the description should be a longer explanation of the node, and the parent_id should be the id of the parent node or null if it is a root node. The topic will be provided in the user message and you should generate nodes that are relevant to that topic.";

export async function POST(request: NextRequest) {
  const { topic, originalInput } = await request.json();

  const userMessage = originalInput
    ? `The user wants to learn about: ${originalInput}. They have clarified they mean: ${topic}. Generate the node based on their full intent.`
    : topic;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = completion.choices[0].message.content ?? "";
  const result = JSON.parse(raw);

  console.log(result);

  return Response.json(result);
}
