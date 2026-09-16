import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { PersonNode } from '@/components/person-node';
import { Spacing, Type } from '@/constants/theme';
import { layoutPeople } from '@/lib/explore-layout';
import {
  availableIn,
  hasNextRound,
  postForRound,
  roundComplete,
  unseenCount,
  type ExploreSession,
} from '@/lib/explore-session';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';

interface ExploreCanvasProps {
  session: ExploreSession;
  /** How many people the reader follows (for the footer line). */
  followingCount: number;
  onOpenPerson: (personId: string) => void;
  onNextRound: () => void;
}

/**
 * Explore as a space rather than a stream. Everyone outside the reader's
 * circle who has posted is placed once; the reader chooses whom to open.
 * Nothing here ranks people — position and size carry no meaning.
 */
export function ExploreCanvas({
  session,
  followingCount,
  onOpenPerson,
  onNextRound,
}: ExploreCanvasProps) {
  const { colors } = useTheme();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [asList, setAsList] = useState(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  const points = layoutPeople(
    session.people.map((p) => p.id),
    box,
  );
  const remaining = unseenCount(session);
  const complete = roundComplete(session);
  const more = hasNextRound(session);
  const available = availableIn(session).length;

  const footer = complete ? (
    <View style={styles.ending}>
      <Text style={[styles.endingTitle, { color: colors.text }]}>
        {session.round === 1
          ? "You've met everyone outside your circle."
          : `That's everyone's post ${session.round}.`}
      </Text>
      {more ? (
        <Button title="See their next posts" variant="outline" compact onPress={onNextRound} />
      ) : (
        <Text style={[styles.endingDetail, { color: colors.textSecondary }]}>
          Nothing more from them for now.
        </Text>
      )}
    </View>
  ) : (
    <View style={styles.status}>
      <Text style={[styles.statusLine, { color: colors.textSecondary }]}>
        {remaining === 1
          ? '1 person you haven’t met yet.'
          : `${remaining} people you haven’t met yet.`}
        {session.round > 1 ? `  ·  Round ${session.round}` : ''}
      </Text>
      {followingCount > 0 ? (
        <Text style={[styles.statusLine, { color: colors.textTertiary }]}>
          {followingCount === 1
            ? '1 person you follow is inside your circle.'
            : `${followingCount} people you follow are inside your circle.`}
        </Text>
      ) : null}
    </View>
  );

  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={asList ? 'Show as space' : 'Show as list'}
      onPress={() => setAsList((v) => !v)}
      hitSlop={10}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons
        name={asList ? 'scan-outline' : 'list-outline'}
        size={20}
        color={colors.textSecondary}
      />
    </Pressable>
  );

  // VoiceOver and very large text get the same people as a list, in a fixed
  // alphabetical order, with the same seen / unseen state.
  const listPeople = [...session.people].sort((a, b) =>
    a.author.display_name.localeCompare(b.author.display_name),
  );

  if (asList || available === 0) {
    return (
      <View style={styles.fill}>
        {available > 0 ? toggle : null}
        <ScrollView contentContainerStyle={styles.list}>
          {listPeople.map((person) => {
            const post = postForRound(person, session.round);
            const seen = session.seen.has(person.id);
            return (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`${person.author.display_name}, ${
                  post ? (seen ? 'seen' : 'not yet seen') : 'no more posts'
                }`}
                onPress={post ? () => onOpenPerson(person.id) : undefined}
                disabled={!post}
                style={({ pressed }) => [
                  styles.listRow,
                  (!post || seen) && styles.quiet,
                  pressed && post && styles.pressed,
                ]}
              >
                <Avatar url={person.author.avatar_url} name={person.author.display_name} size={40} />
                <View style={styles.listText}>
                  <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
                    {person.author.display_name}
                  </Text>
                  <Text style={[styles.listMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                    {post ? `Latest post ${timeAgo(post.created_at)}` : 'No more posts'}
                  </Text>
                </View>
                {seen && post ? (
                  <Ionicons name="checkmark" size={16} color={colors.textSecondary} />
                ) : null}
              </Pressable>
            );
          })}
          {footer}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {toggle}
      <View style={styles.canvas} onLayout={handleLayout}>
        {box.width > 0 ? (
          <>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.you,
                {
                  left: box.width / 2 - 14,
                  top: box.height / 2 - 14,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.youDot, { backgroundColor: colors.text }]} />
              <Text style={[styles.youLabel, { color: colors.textTertiary }]}>you</Text>
            </View>
            {points.map((point) => {
              const person = session.people.find((p) => p.id === point.id);
              if (!person) return null;
              const post = postForRound(person, session.round);
              return (
                <View
                  key={person.id}
                  style={[
                    styles.nodeWrap,
                    { left: point.x - (point.size + 24) / 2, top: point.y - point.size / 2 },
                  ]}
                >
                  <PersonNode
                    author={person.author}
                    size={point.size}
                    seen={session.seen.has(person.id)}
                    postedAt={post?.created_at ?? null}
                    onPress={post ? () => onOpenPerson(person.id) : null}
                  />
                </View>
              );
            })}
          </>
        ) : null}
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  nodeWrap: {
    position: 'absolute',
  },
  you: {
    position: 'absolute',
    width: 28,
    alignItems: 'center',
    gap: 2,
  },
  youDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  youLabel: Type.micro,
  toggle: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.lg,
    zIndex: 1,
    padding: Spacing.xs,
  },
  status: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  statusLine: Type.caption,
  ending: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  endingTitle: {
    ...Type.chapter,
    textAlign: 'center',
  },
  endingDetail: {
    ...Type.caption,
    textAlign: 'center',
  },
  list: {
    paddingTop: Spacing.xxl + Spacing.md,
    paddingBottom: Spacing.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  listText: {
    flex: 1,
    gap: 1,
  },
  listName: Type.bodyStrong,
  listMeta: Type.caption,
  quiet: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
