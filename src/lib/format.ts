import type { Locale } from '@/i18n/core';
import { getActiveLocale, tStatic } from '@/i18n/active';

/**
 * "5m", "3h", "Yesterday", "4d" style relative timestamp for feed rows, in
 * the app language. Older than a week shows the date in the same language.
 */
export function timeAgo(iso: string, locale: Locale = getActiveLocale()): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return tStatic('time.now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return tStatic('time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tStatic('time.hours', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return tStatic('time.yesterday');
  if (days < 7) return tStatic('time.days', { n: days });
  return new Date(iso).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}
