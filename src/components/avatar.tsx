import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Motion, Radius } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/lib/theme';

const DEFAULT_AVATAR = require('@/assets/images/default-avatar.png');

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
}

/** Profile image, or the quiet default silhouette when none is set. */
export function Avatar({ url, name, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const t = useT();
  const shape = { width: size, height: size, borderRadius: Radius.full };
  return (
    <Image
      source={url ? { uri: url } : DEFAULT_AVATAR}
      style={[styles.image, shape, { backgroundColor: colors.surface }]}
      contentFit="cover"
      transition={{ duration: Motion.base, effect: 'cross-dissolve' }}
      accessibilityLabel={t('avatar.a11y', { name })}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
});
