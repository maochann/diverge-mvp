import { resolveLocale, translateIn, type Locale, type Params } from '@/i18n/core';
import { dictionaries, type TranslationKey } from '@/i18n/translations';

/**
 * The locale in effect right now, for code that runs outside React (error
 * mapping, services, formatting helpers). `LocaleProvider` keeps it current;
 * nothing else should set it.
 */
let activeLocale: Locale = resolveLocale('system', []);

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

/** Translate with the active locale, for code that can't use the hook. */
export function tStatic(key: TranslationKey, params?: Params): string {
  return translateIn(dictionaries[activeLocale], key, params);
}
