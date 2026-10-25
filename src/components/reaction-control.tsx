import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { REACTION_KINDS, type ReactionKind } from '@/constants/reactions';
import { Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { errorMessage } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { clearReaction, setReaction } from '@/services/reactions';
import type { FeedPost } from '@/types';

interface ReactionControlProps {
  post: FeedPost;
  viewerId: string;
  /** Tell the owning screen so the card can re-render with the new word. */
  onChange: (post: FeedPost, kind: ReactionKind | null) => void;
}

/**
 * Where the heart used to be: a small circle that, once tapped, offers
 * three words. The chosen word stays next to the circle in ink; nothing is
 * counted and nobody else sees it except the post's author.
 */
export function ReactionControl({ post, viewerId, onChange }: ReactionControlProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = post.my_reaction;

  const choose = async (kind: ReactionKind | null) => {
    setOpen(false);
    if (kind === current) kind = null;
    const before = current;
    onChange(post, kind);
    setBusy(true);
    try {
      if (kind === null) await clearReaction(post.id, viewerId);
      else await setReaction(post.id, viewerId, kind);
    } catch (e) {
      onChange(post, before);
      Alert.alert(t('reaction.failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          current ? t('reaction.yoursA11y', { word: t(`reaction.${current}`) }) : t('reaction.openA11y')
        }
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        disabled={busy}
        hitSlop={8}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons
          name={current ? 'ellipse' : 'ellipse-outline'}
          size={18}
          color={current ? colors.tint : colors.textTertiary}
        />
        {current ? (
          <Text style={[styles.word, { color: colors.tint }]}>{t(`reaction.${current}`)}</Text>
        ) : null}
      </Pressable>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(Motion.fast)}
          exiting={FadeOut.duration(Motion.fast)}
          style={styles.menu}
        >
          {REACTION_KINDS.map((kind) => {
            const active = kind === current;
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={
                  active ? t('reaction.removeA11y') : t('reaction.chooseA11y', { word: t(`reaction.${kind}`) })
                }
                onPress={() => void choose(kind)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: active ? colors.tint : colors.border,
                    backgroundColor: active ? colors.tintSoft : colors.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.optionText, { color: active ? colors.tint : colors.text }]}>
                  {t(`reaction.${kind}`)}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 1,
    minHeight: 32,
  },
  word: Type.caption,
  menu: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  option: {
    minHeight: 28,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: 'center',
  },
  optionText: Type.caption,
  pressed: {
    opacity: 0.6,
  },
});
