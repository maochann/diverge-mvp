import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { MessageState } from '@/components/message-state';
import { PostCard } from '@/components/post-card';
import { PostSkeletonList } from '@/components/post-skeleton';
import { Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { useRelations } from '@/lib/relations-context';
import { errorMessage } from '@/lib/supabase';
import { useSerif, useTheme } from '@/lib/theme';
import { deletePost } from '@/services/posts';
import { fetchDailyPromptById, fetchPromptAnswers, localDateString } from '@/services/prompts';
import type { DailyPromptRef, FeedPost } from '@/types';

/**
 * The room for one day's prompt: the prompt itself, then everyone's
 * answers in the order they were written. Same prompt, different people;
 * this is where the difference is easiest to see. No ranking, no counts.
 */
export default function PromptRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const serif = useSerif();
  const { sets } = useRelations();
  const userId = session?.user.id ?? '';

  const [prompt, setPrompt] = useState<DailyPromptRef | null | undefined>(undefined);
  const [answers, setAnswers] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([fetchDailyPromptById(id), fetchPromptAnswers(id, userId)]);
      setPrompt(p);
      setAnswers(a);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => (answers ?? []).filter((p) => !(sets?.muted.has(p.user_id) ?? false)),
    [answers, sets],
  );
  const isToday = prompt?.prompt_date === localDateString();
  const answered = visible.some((p) => p.user_id === userId);

  const patch = (post: FeedPost) =>
    setAnswers((cur) => (cur ?? []).map((p) => (p.id === post.id ? post : p)));

  const handleDelete = async (post: FeedPost) => {
    try {
      await deletePost(post.id);
      setAnswers((cur) => (cur ?? []).filter((p) => p.id !== post.id));
    } catch (e) {
      Alert.alert(t('feed.deleteFailed'), errorMessage(e));
    }
  };

  if (error !== null && answers === null) {
    return (
      <MessageState
        icon="cloud-offline-outline"
        title={t('prompt.answersLoadFailed')}
        detail={error}
        actionTitle={t('common.retry')}
        onAction={() => void load()}
      />
    );
  }
  if (prompt === null) {
    return <MessageState icon="help-circle-outline" title={t('prompt.unavailable')} />;
  }

  const text = prompt ? (locale === 'ja' ? prompt.text_ja : prompt.text_en) : '';

  return (
    <>
      <Stack.Screen options={{ title: t('prompt.room') }} />
      <FlatList
        style={[styles.screen, { backgroundColor: colors.background }]}
        data={visible}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>
              {isToday ? t('prompt.title') : prompt?.prompt_date ?? ''}
            </Text>
            <Text style={[styles.prompt, serif.strong, { color: colors.text }]}>{text}</Text>
            {isToday && !answered && answers !== null ? (
              <Button
                title={t('prompt.answerThis')}
                variant="outline"
                compact
                onPress={() => router.push('/compose?prompt=today')}
                style={styles.answer}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={item.user_id === userId}
            onToggleLike={() => undefined}
            onOpenComments={(p) => router.push(`/post/${p.id}`)}
            onOpenAuthor={(uid) => router.push(`/user/${uid}`)}
            onAuthorBlocked={() => void load()}
            onDelete={handleDelete}
            onReaction={patch}
          />
        )}
        ListEmptyComponent={
          answers === null ? (
            <PostSkeletonList count={2} />
          ) : (
            <MessageState
              compact
              icon="chatbubble-ellipses-outline"
              title={t('prompt.answersEmpty.title')}
              detail={isToday ? t('prompt.answersEmpty.detail') : undefined}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    ...Type.captionStrong,
    letterSpacing: 0.3,
  },
  prompt: {
    ...Type.display,
  },
  answer: {
    marginTop: Spacing.md,
  },
});
