import { supabase } from '@/lib/supabase';
import { runPostQuery } from '@/services/posts';
import type { DailyPromptRef, FeedPost, PostAuthor } from '@/types';

interface DailyPromptRow {
  id: string;
  prompt_date: string;
  prompt_id: string;
  text_en: string;
  text_ja: string;
}

/** The reader's calendar date, as YYYY-MM-DD in their own time zone. */
export function localDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Today's prompt. Created on first request for the date, the same for
 * everyone whose calendar says it is that day. Null when the pool is empty.
 */
export async function fetchDailyPrompt(date: string = localDateString()): Promise<DailyPromptRef | null> {
  const { data, error } = await supabase.rpc('daily_prompt_for', { p_date: date });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as DailyPromptRow[])[0];
  if (!row) return null;
  return { id: row.id, prompt_date: row.prompt_date, text_en: row.text_en, text_ja: row.text_ja };
}

/** One prompt by its daily id (for the room of a past day). Null if hidden or gone. */
export async function fetchDailyPromptById(id: string): Promise<DailyPromptRef | null> {
  const { data, error } = await supabase
    .from('daily_prompts')
    .select('id, prompt_date, prompt:prompt_pool ( text_en, text_ja )')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as unknown as {
    id: string;
    prompt_date: string;
    prompt: { text_en: string; text_ja: string } | null;
  } | null;
  if (!row || !row.prompt) return null;
  return { id: row.id, prompt_date: row.prompt_date, text_en: row.prompt.text_en, text_ja: row.prompt.text_ja };
}

/**
 * Everyone's answers to one prompt, in the order they were written. The
 * reader's own answer belongs here too. Blocks are handled by RLS; mutes
 * are the caller's job (it has the sets).
 */
export async function fetchPromptAnswers(dailyPromptId: string, viewerId: string): Promise<FeedPost[]> {
  return runPostQuery(viewerId, (q) =>
    q.eq('daily_prompt_id', dailyPromptId).order('created_at', { ascending: true }).limit(200),
  );
}

export interface Answerer extends PostAuthor {
  id: string;
}

/** Who has answered a prompt so far (distinct people, first-come order). */
export async function fetchPromptAnswerers(dailyPromptId: string, limit = 8): Promise<Answerer[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('user_id, created_at, author:profiles!posts_user_id_fkey ( username, display_name, avatar_url )')
    .eq('daily_prompt_id', dailyPromptId)
    .order('created_at', { ascending: true })
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = data as unknown as { user_id: string; author: PostAuthor }[];
  const seen = new Set<string>();
  const people: Answerer[] = [];
  for (const row of rows) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    people.push({ id: row.user_id, ...row.author });
    if (people.length >= limit) break;
  }
  return people;
}
