import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { ForkLine } from '@/components/fork-line';
import { Motion, Type } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Outline icon with the fork mark underneath when selected. */
function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={name} size={22} color={color} />
      <View style={styles.tabMark}>
        {focused ? <ForkLine width={20} color={String(color)} /> : null}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      // Moving between the three places is a small change of scene: a short
      // shift, and the system's selection tick under the finger.
      screenListeners={{ tabPress: () => selectionHaptic() }}
      screenOptions={{
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: { duration: Motion.fast },
        },
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { ...Type.title, fontSize: 22, color: colors.text },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Post',
          headerTitle: 'New post',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="create-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
  },
  tabMark: {
    height: 8,
    marginTop: 1,
    justifyContent: 'flex-end',
  },
  headerButton: {
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.6,
  },
});
