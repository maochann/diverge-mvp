import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Spacing, Type } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { PostAuthor } from '@/types';

interface PersonNodeProps {
  author: PostAuthor;
  size: number;
  /** Whether the reader has opened this person's post in the current round. */
  seen: boolean;
  /** When their post for this round was written; read out for VoiceOver. */
  postedAt: string | null;
  /** Null when they have nothing to show this round (dimmed, not tappable). */
  onPress: (() => void) | null;
}

/**
 * One person on the Explore canvas: an avatar with a ring while unseen,
 * quieter once opened. Nothing about the node's size or ring encodes
 * popularity — everyone here is the same size within a ring.
 */
export function PersonNode({ author, size, seen, postedAt, onPress }: PersonNodeProps) {
  const { colors } = useTheme();
  const disabled = onPress === null;
  const state = disabled ? 'no more posts' : seen ? 'seen' : 'not yet seen';
  const when = postedAt ? `, latest post ${timeAgo(postedAt)}` : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${author.display_name}, ${state}${when}`}
      accessibilityState={{ disabled }}
      onPress={onPress ?? undefined}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.node,
        { width: size + 24 },
        (seen || disabled) && styles.quiet,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: seen || disabled ? 'transparent' : colors.tint,
          },
        ]}
      >
        <Avatar url={author.avatar_url} name={author.display_name} size={size - 8} />
      </View>
      <View style={styles.nameRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {author.display_name}
        </Text>
        {seen && !disabled ? (
          <Ionicons name="checkmark" size={11} color={colors.textSecondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  node: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
  },
  name: {
    ...Type.micro,
    flexShrink: 1,
  },
  quiet: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
