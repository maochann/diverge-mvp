import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Tappable } from '@/components/tappable';
import { Motion, Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useRelations } from '@/lib/relations-context';
import { useSerif, useTheme } from '@/lib/theme';
import { fetchDailyPrompt, fetchPromptAnswerers, type Answerer } from '@/services/prompts';
import type { DailyPromptRef } from '@/types';

/**
 * One quiet line at the top of the feed: today's prompt, and the faces of
 * the people who have answered so far. No number, no "be the first" nudge;
 * tapping opens the room where all the answers sit together.
 */
export function TodayPromptBanner() {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const serif = useSerif();
  const { sets } = useRelations();
  const [prompt, setPrompt] = useState<DailyPromptRef | null>(null);
  const [people, setPeople] = useState<Answerer[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchDailyPrompt()
        .then(async (p) => {
          if (cancelled) return;
          setPrompt(p);
          if (p) setPeople(await fetchPromptAnswerers(p.id));
        })
        .catch(() => {
          // The banner is an invitation, not a requirement.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!prompt) return null;
  const text = locale === 'ja' ? prompt.text_ja : prompt.text_en;
  const faces = people.filter((p) => !(sets?.muted.has(p.id) ?? false)).slice(0, 5);

  return (
    <Animated.View entering={FadeIn.duration(Motion.base)}>
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={t('prompt.bannerA11y', { prompt: text })}
        onPress={() => router.push(`/prompt/${prompt.id}`)}
        style={[styles.banner, { borderColor: colors.border }]}
      >
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>{t('prompt.title')}</Text>
          <Text style={[styles.prompt, serif.regular, { color: colors.text }]} numberOfLines={1}>
            {text}
          </Text>
        </View>
        {faces.length > 0 ? (
          <View style={styles.faces} accessibilityElementsHidden>
            {faces.map((p, i) => (
              <View key={p.id} style={[styles.face, i > 0 && styles.faceOverlap, { borderColor: colors.background }]}>
                <Avatar url={p.avatar_url} name={p.display_name} size={22} />
              </View>
            ))}
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Tappable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...Type.micro,
    letterSpacing: 0.3,
  },
  prompt: {
    ...Type.chapter,
    fontSize: 18,
    lineHeight: 24,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderRadius: 999,
    borderWidth: 2,
  },
  faceOverlap: {
    marginLeft: -8,
  },
  pressed: {
    opacity: 0.6,
  },
});
