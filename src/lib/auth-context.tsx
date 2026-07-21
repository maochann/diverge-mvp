import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profiles';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** True until the persisted session (if any) has been restored. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when the account needs email confirmation before use. */
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoadedProfile {
  userId: string;
  profile: Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  // Derived rather than reset in an effect: a profile only counts if it
  // belongs to the currently signed-in user.
  const profile = userId && loaded?.userId === userId ? loaded.profile : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getProfile(userId)
      .then((p) => {
        if (!cancelled) setLoaded({ userId, profile: p });
      })
      .catch(() => {
        // Profile loads are retried via refreshProfile from the profile screen;
        // failing here must not block sign-in.
        if (!cancelled) setLoaded({ userId, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      username: string,
      displayName: string,
    ) => {
      const cleanUsername = username.trim().toLowerCase();
      // Friendly pre-check; the unique index in the database is the real guard.
      // Usernames are stored lowercase, so exact equality is the right match
      // (ilike would treat underscores in usernames as wildcards).
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();
      if (taken) throw new Error('That username is already taken.');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: cleanUsername, display_name: displayName.trim() },
        },
      });
      if (error) throw new Error(error.message);
      return data.session === null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setLoaded({ userId, profile: await getProfile(userId) });
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        initializing,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
