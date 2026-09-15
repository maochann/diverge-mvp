import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { RelationsProvider } from '@/lib/relations-context';
import { navigationTheme, useTheme } from '@/lib/theme';

function RootNavigator() {
  const { session, initializing } = useAuth();
  const { colors } = useTheme();

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
        headerTitleStyle: { color: colors.text },
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
  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <StatusBar style="auto" />
      <AuthProvider>
        <RelationsProvider>
          <RootNavigator />
        </RelationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
