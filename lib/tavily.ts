import type { Source } from '@/types';

export async function tavilySearch(query: string): Promise<Source[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { results?: { url: string; title: string; content: string }[] };

  return (data.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
  }));
}
