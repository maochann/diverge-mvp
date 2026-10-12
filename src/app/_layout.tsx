import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  useFonts,
} from '@expo-google-fonts/newsreader';
import { useLinkingURL } from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LocaleProvider, useT, type LanguagePreference, type Locale } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { syncReminderLanguage } from '@/lib/daily-prompt-reminder';
import { reminderUrlFrom } from '@/services/notifications';
import { RelationsProvider } from '@/lib/relations-context';
import { Type } from '@/constants/theme';
import { navigationTheme, useSerif, useTheme } from '@/lib/theme';

// A reminder arriving while the app is open shows as a quiet banner: no
// sound, no badge. (The server never sets a badge either.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function RootNavigator() {
  const { session, initializing, completeRecovery, recovering } = useAuth();
  const { colors } = useTheme();
  const t = useT();
  const serif = useSerif();

  // Tapping the day's reminder opens the composer with the prompt selected.
  // Only the reminder exists; any other notification is ignored.
  const handledNotification = useRef<string | null>(null);
  useEffect(() => {
    if (!session) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = reminderUrlFrom(response);
      const id = response?.notification.request.identifier ?? null;
      if (!url || !id || id === handledNotification.current) return;
      handledNotification.current = id;
      router.navigate(url as never);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [session]);

  // Password-reset links open the app with a one-time code. Exchange it for
  // a session, then send the person straight to the new-password screen.
  const url = useLinkingURL();
  const handledUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!url || url === handledUrl.current) return;
    handledUrl.current = url;
    completeRecovery(url)
      .then((isRecovery) => {
        if (isRecovery) router.replace('/change-password');
      })
      .catch((e: unknown) => {
        Alert.alert(t('root.resetLinkProblem'), e instanceof Error ? e.message : String(e));
      });
  }, [url, completeRecovery, t]);

  // If the session appeared before the navigator was ready, land on the
  // new-password screen once it is.
  useEffect(() => {
    if (recovering && session) router.replace('/change-password');
  }, [recovering, session]);

  if (initializing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.tint,
        headerTitleStyle: { ...Type.title, ...serif.strong, fontSize: 20, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: t('nav.post'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="user/[id]" options={{ title: '', headerBackTitle: t('common.back') }} />
        <Stack.Screen
          name="people/[list]"
          options={{ title: '', headerBackTitle: t('common.back') }}
        />
        <Stack.Screen
          name="report"
          options={{ title: t('nav.report'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="explore/person/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.62, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 16,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="compose"
          options={{ title: t('tab.newPost'), presentation: 'modal', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="settings" options={{ title: t('nav.settings'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="language" options={{ title: t('nav.language'), headerBackTitle: t('common.back') }} />
        <Stack.Screen
          name="daily-prompt-settings"
          options={{ title: t('nav.dailyPrompt'), headerBackTitle: t('common.back') }}
        />
        <Stack.Screen
          name="change-password"
          options={{ title: t('nav.changePassword'), headerBackTitle: t('common.back') }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ title: t('nav.editProfile'), presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Reachable signed in or out: reset links land here. */}
      <Stack.Screen name="reset-password" options={{ title: t('nav.resetPassword'), headerShown: false }} />
    </Stack>
  );
}

/** The reminder is sent in the app language, so the server copy follows it. */
function LocaleSync({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const onLocaleChange = useCallback(
    (locale: Locale, _preference: LanguagePreference) => {
      if (userId) void syncReminderLanguage(userId, locale);
    },
    [userId],
  );
  return <LocaleProvider onLocaleChange={onLocaleChange}>{children}</LocaleProvider>;
}

export default function RootLayout() {
  const theme = useTheme();
  // Navigation headers capture their title font once, so wait for the serif
  // (a few ms from the bundle). If it fails, the system font stands in.
  const [fontsLoaded, fontError] = useFonts({ Newsreader_500Medium, Newsreader_600SemiBold });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider value={navigationTheme(theme)}>
        <StatusBar style="auto" />
        <AuthProvider>
          <LocaleSync>
            <RelationsProvider>
              <RootNavigator />
            </RelationsProvider>
          </LocaleSync>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
