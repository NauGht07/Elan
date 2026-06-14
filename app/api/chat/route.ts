import type { AncestorContext, ElanNode, NodeChat } from '@/types';
import { createServerClient } from '@/lib/supabase-server';
import { runChatPipeline } from '@/lib/pipeline';

interface ChatBody {
  node_id: string;
  message: string;
}

export async function POST(request: Request) {
  let body: ChatBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { node_id, message } = body;

  if (!node_id || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch node and verify ownership via tree join
  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .select('*, trees!inner(user_id)')
    .eq('id', node_id)
    .single();

  if (nodeError || !node) {
    return Response.json({ error: 'Node not found' }, { status: 404 });
  }

  if ((node.trees as { user_id: string }).user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build ancestor context from ancestor_ids (ordered by depth)
  let ancestors: AncestorContext[] = [];

  if ((node.ancestor_ids as string[]).length > 0) {
    const { data: ancestorNodes, error: ancestorError } = await supabase
      .from('nodes')
      .select('original_query, type, content, depth')
      .in('id', node.ancestor_ids as string[])
      .order('depth', { ascending: true });

    if (ancestorError) {
      console.error('Ancestor fetch error:', ancestorError);
      return Response.json({ error: 'Failed to fetch ancestors' }, { status: 500 });
    }

    ancestors = (ancestorNodes ?? []).map((a) => ({
      topic: a.original_query as string,
      type: a.type as AncestorContext['type'],
      content: a.content as string,
    }));
  }

  // Fetch existing chat history
  const { data: chatHistory, error: chatError } = await supabase
    .from('node_chats')
    .select('*')
    .eq('node_id', node_id)
    .order('created_at', { ascending: true });

  if (chatError) {
    console.error('Chat history fetch error:', chatError);
    return Response.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }

  let result;
  try {
    result = await runChatPipeline(
      message,
      node as unknown as ElanNode,
      ancestors,
      (chatHistory ?? []) as NodeChat[],
    );
  } catch (err) {
    console.error('Chat pipeline error:', err);
    return Response.json({ error: 'Pipeline failed' }, { status: 500 });
  }

  // Persist both turns
  const { error: insertError } = await supabase
    .from('node_chats')
    .insert([
      { node_id, role: 'user', message },
      { node_id, role: 'assistant', message: result.response },
    ]);

  if (insertError) {
    console.error('Chat insert error:', insertError);
    return Response.json({ error: 'Failed to save messages' }, { status: 500 });
  }

  return Response.json({ response: result.response, sources: result.sources });
}
