// Translates one post into the caller's language, once. The caller must be
// able to read the post (RLS is enforced by reading it as them); the result
// is cached in post_translations so each post is translated at most once per
// language, whoever asks.
//
// Secrets: DEEPL_API_KEY (DeepL API Free keys end in ":fx" and use the
// api-free host). Deploy: npx supabase functions deploy translate
import { createClient } from 'npm:@supabase/supabase-js@2';

const TARGETS = new Set(['EN', 'JA']);

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
  const deeplKey = Deno.env.get('DEEPL_API_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'function not configured' }, 500);
  if (!deeplKey) return json({ error: 'translation is not set up yet' }, 503);

  let body: { postId?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const postId = body.postId;
  const target = (body.target ?? '').toUpperCase();
  if (!postId || !TARGETS.has(target)) return json({ error: 'bad request' }, 400);

  // Read the post as the caller: if they can't see it, they can't translate it.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  const { data: post, error: postError } = await asCaller
    .from('posts')
    .select('id, content')
    .eq('id', postId)
    .maybeSingle();
  if (postError) return json({ error: postError.message }, 500);
  if (!post) return json({ error: 'not found' }, 404);

  const admin = createClient(url, serviceKey);
  const { data: cached } = await admin
    .from('post_translations')
    .select('text, source_lang')
    .eq('post_id', postId)
    .eq('lang', target)
    .maybeSingle();
  if (cached) return json({ text: cached.text, sourceLang: cached.source_lang, cached: true });

  const host = deeplKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const res = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [post.content], target_lang: target }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `translation failed (${res.status})`, detail }, 502);
  }
  const result = (await res.json()) as {
    translations: { text: string; detected_source_language: string }[];
  };
  const translation = result.translations[0];
  if (!translation) return json({ error: 'empty translation' }, 502);

  await admin.from('post_translations').upsert({
    post_id: postId,
    lang: target,
    text: translation.text,
    source_lang: translation.detected_source_language,
  });

  return json({ text: translation.text, sourceLang: translation.detected_source_language, cached: false });
});
