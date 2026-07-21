import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
}

/** Profile image, or the first letter of the name as a neutral fallback. */
export function Avatar({ url, name, size = 40 }: AvatarProps) {
  const shape = { width: size, height: size, borderRadius: Radius.full };
  if (url) {
    return <Image source={{ uri: url }} style={shape} contentFit="cover" />;
  }
  return (
    <View style={[styles.fallback, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
