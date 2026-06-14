import type { InterpretationResult, AncestorContext, NodeType, PipelineResult, ElanNode, NodeChat, ChatPipelineResult, Source } from '@/types';
import { groq, LARGE_MODEL, SMALL_MODEL } from '@/lib/groq';
import { tavilySearch } from '@/lib/tavily';

function formatSources(sources: { url: string; title: string; content: string }[]): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})\nContent: ${s.content}`)
    .join('\n\n');
}

export async function getInterpretations(input: string): Promise<InterpretationResult> {
  const completion = await groq.chat.completions.create({
    model: LARGE_MODEL,
    messages: [
      {
        role: 'system',
        content: process.env.AMBIGUITY_CHECK_PROMPT ?? '',
      },
      { role: 'user', content: input },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(
    completion.choices[0].message.content ?? '{}'
  ) as InterpretationResult;
}

export async function runPipeline(
  input: string,
  ancestors: AncestorContext[],
  chosen?: { query: string; type: NodeType }
): Promise<PipelineResult> {
  let query: string;
  let type: NodeType;

  if (chosen) {
    query = chosen.query;
    type = chosen.type;
  } else {
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

    ({ query, type } = JSON.parse(
      rewriteCompletion.choices[0].message.content ?? '{}'
    ) as { query: string; type: NodeType });
  }

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
    '## Query',
    `Original: ${input}`,
    `Rewritten: ${query}`,
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

function formatSourcesIndexed(sources: Source[], startIndex: number): string {
  return sources
    .map((s, i) => `[${startIndex + i}] ${s.title} (${s.url})\nContent: ${s.content}`)
    .join('\n\n');
}

export async function runChatPipeline(
  message: string,
  node: ElanNode,
  ancestors: AncestorContext[],
  chatHistory: NodeChat[],
): Promise<ChatPipelineResult> {
  // Step 1 — large model: decide whether a new search is needed
  const existingSourcesSummary = node.sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url})`)
    .join('\n');

  const needsSearchCompletion = await groq.chat.completions.create({
    model: LARGE_MODEL,
    messages: [
      { role: 'system', content: process.env.CHAT_NEEDS_SEARCH_PROMPT ?? '' },
      {
        role: 'user',
        content: [
          '## Node Content',
          node.content,
          '',
          '## Existing Sources',
          existingSourcesSummary || '(none)',
          '',
          '## User Question',
          message,
        ].join('\n'),
      },
    ],
    response_format: { type: 'json_object' },
  });

  const { needs_search, query } = JSON.parse(
    needsSearchCompletion.choices[0].message.content ?? '{}'
  ) as { needs_search: boolean; query?: string };

  // Step 2 — conditional Tavily fetch
  const newSources: Source[] = needs_search && query
    ? await tavilySearch(query)
    : [];

  // Step 3 — large model: generate chat response
  const existingSourcesBlock = node.sources.length > 0
    ? formatSourcesIndexed(node.sources, 1)
    : '(none)';

  const newSourcesBlock = newSources.length > 0
    ? formatSourcesIndexed(newSources, node.sources.length + 1)
    : '';

  const userMessage = [
    `## Node: ${node.original_query}`,
    node.content,
    '',
    '## Ancestor Chain',
    JSON.stringify(ancestors),
    '',
    '## Sources',
    existingSourcesBlock,
    ...(newSourcesBlock ? [newSourcesBlock] : []),
    '',
    '## New Message',
    message,
  ].join('\n');

  const chatMessages = [
    { role: 'system' as const, content: process.env.CHAT_SYSTEM_PROMPT ?? '' },
    ...chatHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.message,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const responseCompletion = await groq.chat.completions.create({
    model: LARGE_MODEL,
    messages: chatMessages,
  });

  const rawResponse = responseCompletion.choices[0].message.content ?? '';

  // Step 4 — post-process [n] -> [[n]](url) over combined source list
  const combinedSources = [...node.sources, ...newSources];
  const response = rawResponse.replace(/\[(\d+)\]/g, (match, n) => {
    const source = combinedSources[parseInt(n) - 1];
    return source ? `[[${n}]](${source.url})` : match;
  });

  return { response, sources: newSources };
}
