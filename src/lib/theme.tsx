import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

import { DarkColors, LightColors, type Palette } from '@/constants/theme';

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
