import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales, useLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getActiveLocale, setActiveLocale } from '@/i18n/active';
import {
  isLanguagePreference,
  pluralKey,
  resolveLocale,
  translateIn,
  type LanguagePreference,
  type Locale,
  type Params,
} from '@/i18n/core';
import { dictionaries, type TranslationKey } from '@/i18n/translations';

export { getActiveLocale, tStatic } from '@/i18n/active';

export type { LanguagePreference, Locale, Params } from '@/i18n/core';
export type { TranslationKey } from '@/i18n/translations';

/** Device-wide (not per account): the language of the app itself. */
export const LANGUAGE_STORAGE_KEY = 'app-language';

export type Translate = (key: TranslationKey, params?: Params) => string;
/** `tp('chapter.posts', 3)` → "3 posts"; the count is also available as `{n}`. */
export type TranslatePlural = (base: PluralBase, count: number, params?: Params) => string;

/** Keys that exist in both `.one` and `.other` form. */
export type PluralBase = {
  [K in TranslationKey]: K extends `${infer B}.one` ? B : never;
}[TranslationKey];

interface I18nContextValue {
  locale: Locale;
  preference: LanguagePreference;
  setPreference: (next: LanguagePreference) => void;
  t: Translate;
  tp: TranslatePlural;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Static access for code that runs outside React (error mapping, services).
// The provider keeps this in step with the active locale.
// ---------------------------------------------------------------------------

function systemTags(): string[] {
  try {
    return getLocales().map((l) => l.languageTag);
  } catch {
    return [];
  }
}

setActiveLocale(resolveLocale('system', systemTags()));

function makeT(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, params) => translateIn(dictionary, key, params);
}

function makeTp(t: Translate): TranslatePlural {
  return (base, count, params) =>
    t(pluralKey<TranslationKey>(base, count), { n: count, ...params });
}

interface LocaleProviderProps {
  children: ReactNode;
  /** Called once the preference is known and whenever it changes (to sync a server copy). */
  onLocaleChange?: (locale: Locale, preference: LanguagePreference) => void;
}

/**
 * Holds the app language. Starts from the device language; a choice made in
 * Settings is remembered on this device and wins until set back to System.
 * Switching is immediate: every `t()` in the tree re-renders.
 */
export function LocaleProvider({ children, onLocaleChange }: LocaleProviderProps) {
  const locales = useLocales();
  const tags = useMemo(() => locales.map((l) => l.languageTag), [locales]);
  const [preference, setPreferenceState] = useState<LanguagePreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) setPreferenceState(isLanguagePreference(stored) ? stored : 'system');
      })
      .catch(() => {
        if (!cancelled) setPreferenceState('system');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effective = preference ?? 'system';
  const locale = resolveLocale(effective, tags);
  // Keep the static accessor current before children render with the new value.
  if (getActiveLocale() !== locale) setActiveLocale(locale);

  useEffect(() => {
    if (preference !== null) onLocaleChange?.(locale, preference);
  }, [locale, preference, onLocaleChange]);

  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = makeT(locale);
    return { locale, preference: effective, setPreference, t, tp: makeTp(t) };
  }, [locale, effective, setPreference]);

  // A few ms on first launch: avoids a flash of the wrong language.
  if (preference === null) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LocaleProvider');
  return ctx;
}

/** Shorthand when a component only needs `t`. */
export function useT(): Translate {
  return useI18n().t;
}
