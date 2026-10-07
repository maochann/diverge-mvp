import { supabase } from '@/lib/supabase';
import type { DailyPromptRef } from '@/types';

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
