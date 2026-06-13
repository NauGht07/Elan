import { createServerClient } from '@/lib/supabase';

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
