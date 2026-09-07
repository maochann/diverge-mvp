import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
}

/** Profile image, or the first letter of the name as a neutral fallback. */
export function Avatar({ url, name, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: Radius.full };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[shape, { backgroundColor: colors.surface }]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.fallback, shape, { backgroundColor: colors.surface }]}>
      <Text
        style={[styles.initial, { fontSize: size * 0.42, color: colors.textSecondary }]}
      >
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '600',
  },
});
