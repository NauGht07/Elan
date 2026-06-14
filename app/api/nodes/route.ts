import { createServerClient } from '@/lib/supabase-server';

export async function DELETE(request: Request) {
  let body: { node_id: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { node_id } = body;

  if (!node_id || typeof node_id !== 'string') {
    return Response.json({ error: 'Missing required field: node_id' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch target node to get tree_id
  const { data: targetNode, error: nodeError } = await supabase
    .from('nodes')
    .select('id, tree_id, depth')
    .eq('id', node_id)
    .single();

  if (nodeError || !targetNode) {
    return Response.json({ error: 'Node not found' }, { status: 404 });
  }

  // Refuse to delete root nodes — tree deletion handles that
  if (targetNode.depth === 0) {
    return Response.json({ error: 'Cannot delete root node' }, { status: 400 });
  }

  // Verify tree ownership
  const { data: tree, error: treeError } = await supabase
    .from('trees')
    .select('id')
    .eq('id', targetNode.tree_id)
    .eq('user_id', user.id)
    .single();

  if (treeError || !tree) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Collect the target node + all descendants via ancestor_ids
  const { data: nodeRows, error: descendantsError } = await supabase
    .from('nodes')
    .select('id')
    .eq('tree_id', targetNode.tree_id)
    .or(`id.eq.${node_id},ancestor_ids.cs.{${node_id}}`);

  if (descendantsError || !nodeRows) {
    console.error('Descendants fetch error:', descendantsError);
    return Response.json({ error: 'Failed to resolve descendants' }, { status: 500 });
  }

  const ids = nodeRows.map((n) => n.id);

  // Null out spawned_node_id on suggestions pointing into the delete set
  const { error: nullifyError } = await supabase
    .from('suggestions')
    .update({ spawned_node_id: null })
    .in('spawned_node_id', ids);

  if (nullifyError) {
    console.error('Nullify spawned_node_id error:', nullifyError);
    return Response.json({ error: 'Failed to clean up suggestions' }, { status: 500 });
  }

  // Delete suggestions owned by affected nodes
  const { error: suggestionsError } = await supabase
    .from('suggestions')
    .delete()
    .in('node_id', ids);

  if (suggestionsError) {
    console.error('Suggestions delete error:', suggestionsError);
    return Response.json({ error: 'Failed to delete suggestions' }, { status: 500 });
  }

  // Delete chat history for affected nodes
  const { error: chatsError } = await supabase
    .from('node_chats')
    .delete()
    .in('node_id', ids);

  if (chatsError) {
    console.error('Node chats delete error:', chatsError);
    return Response.json({ error: 'Failed to delete chat history' }, { status: 500 });
  }

  // Delete annotations for affected nodes
  const { error: annotationsError } = await supabase
    .from('annotations')
    .delete()
    .in('node_id', ids);

  if (annotationsError) {
    console.error('Annotations delete error:', annotationsError);
    return Response.json({ error: 'Failed to delete annotations' }, { status: 500 });
  }

  // Delete the nodes
  const { error: deleteError } = await supabase
    .from('nodes')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('Nodes delete error:', deleteError);
    return Response.json({ error: 'Failed to delete nodes' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
