import type { AncestorContext, NodeType } from '@/types';
import { createServerClient } from '@/lib/supabase-server';
import { getInterpretations, runPipeline } from '@/lib/pipeline';

interface GenerateBody {
  input: string;
  tree_id?: string;
  parent_id: string | null;
  ancestor_ids: string[];
  ancestors: AncestorContext[];
  query?: string;
  type?: NodeType;
  research_mode?: boolean;
}

export async function POST(request: Request) {
  let body: GenerateBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { input, tree_id, parent_id, ancestor_ids, ancestors, query, type, research_mode = true } = body;

  if (!input || !Array.isArray(ancestor_ids) || !Array.isArray(ancestors)) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No tree_id: get interpretations only, no DB writes
  if (!tree_id) {
    try {
      const result = await getInterpretations(input, ancestors);
      return Response.json(result);
    } catch (err) {
      console.error('Interpretations error:', err);
      return Response.json({ error: 'Failed to get interpretations' }, { status: 500 });
    }
  }

  // With tree_id: full generation + DB write
  const chosen = query && type ? { query, type } : undefined;

  let result;
  try {
    result = await runPipeline(input, ancestors, chosen, research_mode);
  } catch (err) {
    console.error('Pipeline error:', err);
    return Response.json({ error: 'Pipeline failed' }, { status: 500 });
  }

  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .insert({
      tree_id,
      parent_id,
      ancestor_ids,
      depth: ancestor_ids.length,
      type: result.type,
      original_query: input,
      content: result.content,
      sources: result.sources,
    })
    .select()
    .single();

  if (nodeError || !node) {
    console.error('Node insert error:', nodeError);
    return Response.json({ error: 'Failed to save node' }, { status: 500 });
  }

  let suggestions: unknown[] = [];

  if (result.suggestions.length > 0) {
    const { data, error: suggestionsError } = await supabase
      .from('suggestions')
      .insert(
        result.suggestions.map((s) => ({
          node_id: node.id,
          topic: s.topic,
          type: s.type,
        }))
      )
      .select();

    if (suggestionsError) {
      console.error('Suggestions insert error:', suggestionsError);
      return Response.json({ error: 'Failed to save suggestions' }, { status: 500 });
    }

    suggestions = data ?? [];
  }

  return Response.json({ node, suggestions });
}
