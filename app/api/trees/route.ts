import { createServerClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  let body: { title: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return Response.json({ error: 'Missing required field: title' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tree, error } = await supabase
    .from('trees')
    .insert({ title: title.trim(), user_id: user.id })
    .select()
    .single();

  if (error || !tree) {
    console.error('Tree insert error:', error);
    return Response.json({ error: 'Failed to create tree' }, { status: 500 });
  }

  return Response.json({ tree });
}

export async function PATCH(request: Request) {
  let body: { tree_id: string; title: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { tree_id, title } = body;

  if (!tree_id || typeof tree_id !== 'string') {
    return Response.json({ error: 'Missing required field: tree_id' }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return Response.json({ error: 'Missing required field: title' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('trees')
    .update({ title: title.trim() })
    .eq('id', tree_id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Tree rename error:', error);
    return Response.json({ error: 'Failed to rename tree' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  let body: { tree_id: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { tree_id } = body;

  if (!tree_id || typeof tree_id !== 'string') {
    return Response.json({ error: 'Missing required field: tree_id' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('trees')
    .delete()
    .eq('id', tree_id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Tree delete error:', error);
    return Response.json({ error: 'Failed to delete tree' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
