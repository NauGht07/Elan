import type { AncestorContext } from '@/types';
import { createServerClient } from '@/lib/supabase';
import { runPipeline } from '@/lib/pipeline';

interface GenerateBody {
  input: string;
  tree_id: string;
  parent_id: string | null;
  ancestor_ids: string[];
  ancestors: AncestorContext[];
}

export async function POST(request: Request) {
  let body: GenerateBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { input, tree_id, parent_id, ancestor_ids, ancestors } = body;

  if (
    !input ||
    !tree_id ||
    !Array.isArray(ancestor_ids) ||
    !Array.isArray(ancestors)
  ) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let result;
  try {
    result = await runPipeline(input, ancestors);
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
