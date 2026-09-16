import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  useFonts,
} from '@expo-google-fonts/newsreader';
import { useLinkingURL } from 'expo-linking';
import { Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { RelationsProvider } from '@/lib/relations-context';
import { Type } from '@/constants/theme';
import { navigationTheme, useTheme } from '@/lib/theme';

function RootNavigator() {
  const { session, initializing, completeRecovery, recovering } = useAuth();
  const { colors } = useTheme();

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
        Alert.alert('Reset link problem', e instanceof Error ? e.message : String(e));
      });
  }, [url, completeRecovery]);

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
        headerTitleStyle: { ...Type.title, fontSize: 20, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Post', headerBackTitle: 'Back' }} />
        <Stack.Screen name="user/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name="people/[list]"
          options={{ title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="report"
          options={{ title: 'Report', presentation: 'modal' }}
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
        <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name="change-password"
          options={{ title: 'Change password', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ title: 'Edit profile', presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
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
          <RelationsProvider>
            <RootNavigator />
          </RelationsProvider>
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
