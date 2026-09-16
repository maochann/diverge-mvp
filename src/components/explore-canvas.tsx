import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { PersonNode } from '@/components/person-node';
import { Spacing, Type } from '@/constants/theme';
import { layoutCanvas } from '@/lib/explore-layout';
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
import type { Profile } from '@/types';

interface ExploreCanvasProps {
  session: ExploreSession;
  /** The reader, drawn at the centre of their circle. */
  me: Profile | null;
  /** Ids of the people the reader follows: marks inside the circle. */
  insideIds: readonly string[];
  onOpenPerson: (personId: string) => void;
  onNextRound: () => void;
}

const CENTER_SIZE = 28;
const INSIDE_MARK = 6;

/**
 * Explore as a space rather than a stream. The reader's circle is drawn as
 * a single hairline; the people they follow sit inside it as small marks,
 * and everyone else who has posted is placed once, just beyond it. Nothing
 * here ranks people — position and size carry no meaning.
 */
export function ExploreCanvas({
  session,
  me,
  insideIds,
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

  const layout = layoutCanvas(
    session.people.map((p) => p.id),
    insideIds,
    box,
  );
  const remaining = unseenCount(session);
  const complete = roundComplete(session);
  const more = hasNextRound(session);
  const available = availableIn(session).length;
  const insideCount = insideIds.length;

  const insideLine =
    insideCount === 0
      ? 'Your circle is empty for now.'
      : insideCount === 1
        ? '1 in your circle.'
        : `${insideCount} in your circle.`;

  const footer = complete ? (
    <View style={styles.ending}>
      <Text style={[styles.endingTitle, { color: colors.text }]}>
        {session.round === 1
          ? 'That’s everyone beyond your circle.'
          : 'That’s everyone, again.'}
      </Text>
      {more ? (
        <Button title="One more from each" variant="outline" compact onPress={onNextRound} />
      ) : (
        <Text style={[styles.endingDetail, { color: colors.textSecondary }]}>
          Nothing more from them for now.
        </Text>
      )}
    </View>
  ) : (
    <View style={styles.status}>
      <Text style={[styles.statusLine, { color: colors.textSecondary }]}>
        {remaining === 1 ? '1 still to meet.' : `${remaining} still to meet.`}
        {session.round > 1 ? `  ·  Round ${session.round}` : ''}
      </Text>
      <Text style={[styles.statusLine, { color: colors.textTertiary }]}>{insideLine}</Text>
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
        color={colors.textTertiary}
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
              </Pressable>
            );
          })}
          {footer}
        </ScrollView>
      </View>
    );
  }

  const { center, boundaryRadius } = layout;

  return (
    <View style={styles.fill}>
      {toggle}
      <View style={styles.canvas} onLayout={handleLayout}>
        {box.width > 0 ? (
          <>
            {/* The circle itself: one hairline, no fill, no meaning in radius. */}
            <Svg
              width={box.width}
              height={box.height}
              style={StyleSheet.absoluteFill}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Circle
                cx={center.x}
                cy={center.y}
                r={boundaryRadius}
                stroke={colors.border}
                strokeWidth={StyleSheet.hairlineWidth * 2}
                fill="none"
              />
            </Svg>

            {layout.inside.map((mark) => (
              <View
                key={mark.id}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.insideMark,
                  {
                    left: mark.x - INSIDE_MARK / 2,
                    top: mark.y - INSIDE_MARK / 2,
                    backgroundColor: colors.textTertiary,
                  },
                ]}
              />
            ))}

            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.center,
                { left: center.x - CENTER_SIZE / 2, top: center.y - CENTER_SIZE / 2 },
              ]}
            >
              <Avatar url={me?.avatar_url ?? null} name={me?.display_name ?? 'You'} size={CENTER_SIZE} />
            </View>

            {layout.outside.map((point) => {
              const person = session.people.find((p) => p.id === point.id);
              if (!person) return null;
              const post = postForRound(person, session.round);
              return (
                <View
                  key={person.id}
                  style={[
                    styles.nodeWrap,
                    { left: point.x - (point.size + 28) / 2, top: point.y - point.size / 2 },
                  ]}
                >
                  <PersonNode
                    id={person.id}
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
  insideMark: {
    position: 'absolute',
    width: INSIDE_MARK,
    height: INSIDE_MARK,
    borderRadius: INSIDE_MARK / 2,
    opacity: 0.7,
  },
  center: {
    position: 'absolute',
  },
  toggle: {
    position: 'absolute',
    top: 0,
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
    paddingTop: Spacing.xxl + Spacing.sm,
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
  listName: Type.name,
  listMeta: Type.caption,
  quiet: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.7,
  },
});
