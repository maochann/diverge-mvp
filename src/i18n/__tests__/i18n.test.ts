import { describe, expect, it } from 'vitest';

import { getActiveLocale, setActiveLocale, tStatic } from '@/i18n/active';
import {
  interpolate,
  isLanguagePreference,
  pluralKey,
  resolveLocale,
  translateIn,
} from '@/i18n/core';
import { en, ja, type TranslationKey } from '@/i18n/translations';
import { timeAgo } from '@/lib/format';

const keys = Object.keys(en) as TranslationKey[];

/** Keys allowed to be empty in one language because the sentence order differs. */
const MAY_BE_EMPTY: Partial<Record<'en' | 'ja', readonly TranslationKey[]>> = {
  ja: ['signUp.agreePrefix'],
};

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('dictionary parity', () => {
  it('has exactly the same keys in English and Japanese', () => {
    expect(Object.keys(ja).sort()).toEqual([...keys].sort());
  });

  it('has no empty translations (except the documented sentence-order cases)', () => {
    for (const key of keys) {
      expect(en[key].trim(), `en ${key}`).not.toBe('');
      if (!MAY_BE_EMPTY.ja?.includes(key)) expect(ja[key].trim(), `ja ${key}`).not.toBe('');
    }
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of keys) {
      expect(placeholders(ja[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('has both plural forms for every plural key', () => {
    for (const key of keys) {
      if (key.endsWith('.one')) {
        const other = key.replace(/\.one$/, '.other') as TranslationKey;
        expect(en[other], `${key} needs ${other}`).toBeDefined();
      }
      // `.other` alone is a plain key (e.g. report.reason.other), not a plural.
    }
  });
});

describe('interpolation', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Hello {name}, {n} new', { name: 'Mao', n: 3 })).toBe('Hello Mao, 3 new');
    expect(interpolate('Hello {missing}', { name: 'x' })).toBe('Hello {missing}');
    expect(interpolate('plain')).toBe('plain');
  });

  it('translates through a dictionary with params', () => {
    expect(translateIn(en, 'chapter.label', { n: 2 })).toBe('Chapter 2');
    expect(translateIn(ja, 'chapter.label', { n: 2 })).toBe('第2章');
    expect(translateIn(en, 'reply.replyingTo', { username: 'mao' })).toBe('Replying to @mao');
    expect(translateIn(ja, 'reply.replyingTo', { username: 'mao' })).toBe('@mao に返信');
  });

  it('picks plural forms', () => {
    expect(pluralKey('chapter.posts', 1)).toBe('chapter.posts.one');
    expect(pluralKey('chapter.posts', 0)).toBe('chapter.posts.other');
    expect(pluralKey('chapter.posts', 12)).toBe('chapter.posts.other');
    expect(translateIn(en, pluralKey('reply.view', 1), { n: 1 })).toBe('View 1 reply');
    expect(translateIn(en, pluralKey('reply.view', 3), { n: 3 })).toBe('View 3 replies');
    expect(translateIn(ja, pluralKey('reply.view', 3), { n: 3 })).toBe('3件の返信を見る');
  });
});

describe('language resolution', () => {
  it('follows the device when set to System', () => {
    expect(resolveLocale('system', ['ja-JP', 'en-US'])).toBe('ja');
    expect(resolveLocale('system', ['en-CA'])).toBe('en');
    expect(resolveLocale('system', ['fr-FR', 'ja-JP'])).toBe('ja');
    expect(resolveLocale('system', ['fr-FR'])).toBe('en');
    expect(resolveLocale('system', [])).toBe('en');
  });

  it('lets an explicit choice win over the device language', () => {
    expect(resolveLocale('ja', ['en-US'])).toBe('ja');
    expect(resolveLocale('en', ['ja-JP'])).toBe('en');
  });

  it('only accepts known stored preferences (anything else falls back to System)', () => {
    expect(isLanguagePreference('ja')).toBe(true);
    expect(isLanguagePreference('system')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
    expect(isLanguagePreference(null)).toBe(false);
  });
});

describe('language switch at runtime', () => {
  it('changes what the static translator and relative times return', () => {
    const before = getActiveLocale();
    try {
      setActiveLocale('en');
      expect(tStatic('settings.logOut')).toBe('Log out');
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const yesterday = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
      expect(timeAgo(threeHoursAgo)).toBe('3h');
      expect(timeAgo(yesterday)).toBe('Yesterday');
      setActiveLocale('ja');
      expect(tStatic('settings.logOut')).toBe('ログアウト');
      expect(timeAgo(threeHoursAgo)).toBe('3時間');
      expect(timeAgo(yesterday)).toBe('昨日');
      expect(timeAgo(new Date().toISOString())).toBe('今');
    } finally {
      setActiveLocale(before);
    }
  });
});
