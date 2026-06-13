import type { AncestorContext, NodeType, PipelineResult } from '@/types';
import { groq, LARGE_MODEL, SMALL_MODEL } from '@/lib/groq';
import { tavilySearch } from '@/lib/tavily';

function formatSources(sources: { url: string; title: string; content: string }[]): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})\nContent: ${s.content}`)
    .join('\n\n');
}

export async function runPipeline(
  input: string,
  ancestors: AncestorContext[]
): Promise<PipelineResult> {
  // Step 1 — small LLM: rewrite query and classify intent
  const rewriteCompletion = await groq.chat.completions.create({
    model: SMALL_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Rewrite the user input as a concise search query and classify its intent. ' +
          'Respond with JSON only: { "query": string, "type": "factual" | "practical" }',
      },
      { role: 'user', content: input },
    ],
    response_format: { type: 'json_object' },
  });

  const { query, type } = JSON.parse(
    rewriteCompletion.choices[0].message.content ?? '{}'
  ) as { query: string; type: NodeType };

  // Step 2 — Tavily: fetch live sources
  const tavilyQuery = type === 'practical' ? `${query} tutorial how to guide` : query;
  const sources = await tavilySearch(tavilyQuery);

  // Step 3 — large LLM: generate node content
  const userPrompt = type === 'factual'
    ? (process.env.USER_PROMPT_FACTUAL ?? '')
    : (process.env.USER_PROMPT_PRACTICAL ?? '');

  const userMessage = [
    userPrompt,
    '',
    '## Ancestor Chain',
    JSON.stringify(ancestors),
    '',
    '## Sources',
    formatSources(sources),
  ].join('\n');

  const contentCompletion = await groq.chat.completions.create({
    model: LARGE_MODEL,
    messages: [
      { role: 'system', content: process.env.SYSTEM_PROMPT ?? '' },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(
    contentCompletion.choices[0].message.content ?? '{}'
  ) as { content: string; suggestions: { topic: string; type: NodeType }[] };

  const content = parsed.content.replace(/\[(\d+)\]/g, (match, n) => {
    const source = sources[parseInt(n) - 1];
    return source ? `[[${n}]](${source.url})` : match;
  });

  return {
    type,
    content,
    sources,
    suggestions: parsed.suggestions,
  };
}
