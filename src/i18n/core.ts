/**
 * The pure part of i18n: no React, no storage, no device APIs, so it can be
 * tested on its own. The provider in `index.tsx` wires it to the app.
 */

/** UI languages the app ships. User content is never translated by this. */
export type Locale = 'en' | 'ja';

/** What the person chose in Settings. 'system' follows the OS language. */
export type LanguagePreference = 'system' | Locale;

export const LOCALES: readonly Locale[] = ['en', 'ja'];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja';
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLocale(value);
}

/**
 * Which UI language to use. 'system' takes the first OS language the app
 * ships; anything else (or an unknown system language) reads as English.
 */
export function resolveLocale(
  preference: LanguagePreference,
  systemLanguageTags: readonly string[],
): Locale {
  if (preference !== 'system') return preference;
  for (const tag of systemLanguageTags) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export type Params = Record<string, string | number>;

/** `{name}` placeholders. Unknown placeholders are left as-is so a typo is visible. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * Look a key up in one dictionary. Plural keys are stored as `key.one` and
 * `key.other`; pass `count` to pick one (English picks `one` only for exactly
 * 1; Japanese has no plural, so both entries hold the same text).
 */
export function translateIn<K extends string>(
  dictionary: Readonly<Record<K, string>>,
  key: K,
  params?: Params,
): string {
  const template = dictionary[key];
  if (template === undefined) return key;
  return interpolate(template, params);
}

export function pluralKey<K extends string>(base: string, count: number): K {
  return `${base}.${count === 1 ? 'one' : 'other'}` as K;
}
