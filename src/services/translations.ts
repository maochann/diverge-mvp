import { supabase } from '@/lib/supabase';

export type TranslationTarget = 'EN' | 'JA';

/** Languages the app can translate into; everything else reads as English. */
export function deviceTarget(): TranslationTarget {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase().startsWith('ja') ? 'JA' : 'EN';
  } catch {
    return 'EN';
  }
}

const JAPANESE = /[぀-ヿ㐀-鿿]/;

/**
 * Whether a post is worth offering a translation for: written in Japanese
 * when the device reads English, or the other way round. A heuristic, but
 * the reader decides whether to press.
 */
export function needsTranslation(text: string, target: TranslationTarget): boolean {
  const hasJapanese = JAPANESE.test(text);
  return target === 'JA' ? !hasJapanese && /[A-Za-z]{3,}/.test(text) : hasJapanese;
}

interface TranslationResult {
  text: string;
  sourceLang: string | null;
}

/** Translate a post through the `translate` Edge Function (cached server-side). */
export async function translatePost(
  postId: string,
  target: TranslationTarget,
): Promise<TranslationResult> {
  const { data, error } = await supabase.functions.invoke<{
    text?: string;
    sourceLang?: string | null;
    error?: string;
  }>('translate', { method: 'POST', body: { postId, target } });
  if (error) throw new Error(error.message);
  if (!data?.text) throw new Error(data?.error ?? 'Could not translate this post.');
  return { text: data.text, sourceLang: data.sourceLang ?? null };
}
