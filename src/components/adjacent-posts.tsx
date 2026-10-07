import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Tappable } from '@/components/tappable';
import { Motion, Spacing, Type } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/i18n';
import type { AdjacentCandidate } from '@/lib/adjacent';
import { useTheme } from '@/lib/theme';

interface AdjacentPostsProps {
  candidates: readonly AdjacentCandidate[];
}

function reasonKey(c: AdjacentCandidate): TranslationKey {
  switch (c.reason) {
    case 'same_prompt':
      return 'adjacent.samePrompt';
    case 'same_origin':
      return 'adjacent.sameOrigin';
    case 'sibling_branch':
      return c.direction === 'origin'
        ? 'adjacent.siblingBranch.origin'
        : 'adjacent.siblingBranch.branch';
    case 'semantic_related':
      return 'adjacent.title';
  }
}

/**
 * "Another angle": one or two posts that stand in an explicit relation to
 * this one, each with its reason stated. A quiet list, not a carousel, and
 * absent entirely when there is nothing honest to show.
 */
export function AdjacentPosts({ candidates }: AdjacentPostsProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (candidates.length === 0) return null;

  // When every neighbour is here for the same reason, say it once.
  const reasons = new Set(candidates.map(reasonKey));
  const sharedReason = reasons.size === 1 ? [...reasons][0] : null;
  const title = sharedReason ?? 'adjacent.title';

  return (
    <Animated.View
      entering={FadeIn.duration(Motion.slow)}
      style={[styles.block, { borderTopColor: colors.border }]}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>{t(title)}</Text>
      {candidates.map((c) => {
        const reason = t(reasonKey(c));
        return (
          <Tappable
            key={c.post.id}
            accessibilityRole="button"
            accessibilityLabel={t('adjacent.openA11y', { name: c.post.author.display_name, reason })}
            onPress={() => router.push(`/post/${c.post.id}`)}
            style={styles.item}
          >
            <Avatar url={c.post.author.avatar_url} name={c.post.author.display_name} size={28} />
            <View style={styles.itemText}>
              <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                {c.post.author.display_name}
                {sharedReason ? '' : (
                  <Text style={[styles.itemReason, { color: colors.textTertiary }]}>  ·  {reason}</Text>
                )}
              </Text>
              <Text style={[styles.itemBody, { color: colors.textSecondary }]} numberOfLines={2}>
                {c.post.content}
              </Text>
            </View>
          </Tappable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  title: Type.captionStrong,
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemName: Type.name,
  itemReason: Type.caption,
  itemBody: Type.body,
});
