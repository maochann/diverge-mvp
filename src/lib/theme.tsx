import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

import { DarkColors, LightColors, type Palette } from '@/constants/theme';
import { useI18n } from '@/i18n';

export type Scheme = 'light' | 'dark';

export interface AppTheme {
  scheme: Scheme;
  colors: Palette;
}

/** Palette for the device's current appearance. */
export function useTheme(): AppTheme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: scheme === 'dark' ? DarkColors : LightColors };
}

export interface SerifStyles {
  /** For Type.display / Type.title (the heavier serif). */
  strong: { fontFamily?: string; letterSpacing?: number };
  /** For Type.chapter (the lighter serif). */
  regular: { fontFamily?: string; letterSpacing?: number };
}

const NO_OVERRIDE: SerifStyles = { strong: {}, regular: {} };
// iOS ships Hiragino Mincho ProN; W6 pairs with Newsreader SemiBold, W3 with Medium.
const JA_SERIF: SerifStyles = {
  strong: { fontFamily: 'HiraMinProN-W6', letterSpacing: 0 },
  regular: { fontFamily: 'HiraMinProN-W3', letterSpacing: 0 },
};

/**
 * Heading font for the current language. Newsreader has no Japanese glyphs,
 * so in Japanese the serif places use a Mincho face instead of falling back
 * to the system gothic. Spread after a Type.* style: `[styles.title, serif.strong]`.
 */
export function useSerif(): SerifStyles {
  const { locale } = useI18n();
  return locale === 'ja' ? JA_SERIF : NO_OVERRIDE;
}

/** Navigation (headers, tab bar) colors that match the app palette. */
export function navigationTheme({ scheme, colors }: AppTheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
