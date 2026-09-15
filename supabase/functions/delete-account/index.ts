// Deletes the calling user's account: their uploaded photos, then the auth
// user (profile, posts, comments, likes, follows, mutes, blocks and reports
// cascade from it in the database).
//
// Runs with the service role, so it first proves who is calling by resolving
// the Authorization header as that user. Deploy with:
//   npx supabase functions deploy delete-account
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKETS = ['avatars', 'post-images'] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'function not configured' }, 500);

  const authorization = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await asCaller.auth.getUser();
  if (userError || !user) return json({ error: 'not signed in' }, 401);

  const admin = createClient(url, serviceKey);

  for (const bucket of BUCKETS) {
    const { data: files, error: listError } = await admin.storage
      .from(bucket)
      .list(user.id, { limit: 1000 });
    if (listError) return json({ error: listError.message }, 500);
    if (files && files.length > 0) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${user.id}/${f.name}`));
      if (removeError) return json({ error: removeError.message }, 500);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
