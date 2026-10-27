import { Stack, router } from 'expo-router';
import { useEffect } from 'react';

import { hasSeenWelcome } from '@/lib/welcome';

export default function AuthLayout() {
  // First launch on this device: the tour comes before the sign-in form.
  useEffect(() => {
    let cancelled = false;
    hasSeenWelcome().then((seen) => {
      if (!cancelled && !seen) router.replace('/welcome');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return <Stack screenOptions={{ headerShown: false }} />;
}
