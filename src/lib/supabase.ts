import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { tStatic } from '@/i18n/active';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.',
  );
}

// During web static rendering there is no window/storage; a client that tries
// to persist sessions there crashes the dev server on any plain browser request.
const isServerRender = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(isServerRender ? {} : { storage: AsyncStorage }),
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    // No browser URL to parse sessions from in a native app; deep links are
    // handled explicitly (see auth-context completeRecovery).
    detectSessionInUrl: false,
    // PKCE: password-reset links carry a one-time code that only the device
    // which requested the reset can exchange.
    flowType: 'pkce',
  },
});

// Supabase only refreshes auth tokens while told the app is in the foreground.
if (!isServerRender) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/**
 * Turn a thrown value into a message worth showing in the UI. Network-level
 * failures and the most common Supabase auth errors are reworded; everything
 * else passes through as-is.
 */
export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (raw.length === 0) return tStatic('error.generic');

  const lower = raw.toLowerCase();
  if (
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    lower.includes('hostname could not be found') ||
    lower.includes('internet connection appears to be offline') ||
    lower.includes('timed out')
  ) {
    return tStatic('error.network');
  }
  if (lower.includes('invalid login credentials')) {
    return tStatic('error.wrongCredentials');
  }
  if (lower.includes('email not confirmed')) {
    return tStatic('error.emailNotConfirmed');
  }
  if (lower.includes('user already registered')) {
    return tStatic('error.emailTaken');
  }
  if (lower.includes('jwt expired') || lower.includes('refresh token')) {
    return tStatic('error.sessionExpired');
  }
  return raw;
}
