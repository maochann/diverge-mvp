import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

/** Grey placeholder shaped like a post card, shown while a list loads. */
export function PostSkeleton({ withImage = false }: { withImage?: boolean }) {
  const { colors } = useTheme();
  const block = { backgroundColor: colors.skeleton };
  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, block]} />
        <View style={styles.headerText}>
          <View style={[styles.line, styles.name, block]} />
          <View style={[styles.line, styles.meta, block]} />
        </View>
      </View>
      <View style={[styles.line, styles.textFull, block]} />
      <View style={[styles.line, styles.textShort, block]} />
      {withImage ? <View style={[styles.image, block]} /> : null}
    </View>
  );
}

export function PostSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} withImage={i === 0} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
  },
  headerText: {
    flex: 1,
    gap: Spacing.sm,
  },
  line: {
    height: 12,
    borderRadius: Radius.sm,
  },
  name: {
    width: '40%',
  },
  meta: {
    width: '25%',
    height: 10,
  },
  textFull: {
    width: '100%',
  },
  textShort: {
    width: '65%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
  },
});
