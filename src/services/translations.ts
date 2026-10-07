import { tStatic } from '@/i18n/active';
import type { Locale } from '@/i18n/core';
import { supabase } from '@/lib/supabase';

export type TranslationTarget = 'EN' | 'JA';

/** The language the reader has the app in is the language to translate into. */
export function targetForLocale(locale: Locale): TranslationTarget {
  return locale === 'ja' ? 'JA' : 'EN';
}

const JAPANESE = /[぀-ヿ㐀-鿿]/;

/**
 * Whether a post is worth offering a translation for: written in Japanese
 * when the app is in English, or the other way round. A heuristic, but
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
  if (!data?.text) throw new Error(data?.error ?? tStatic('error.translate'));
  return { text: data.text, sourceLang: data.sourceLang ?? null };
}
