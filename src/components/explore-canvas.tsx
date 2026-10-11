import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { PersonNode, type Disturbance } from '@/components/person-node';
import { Spacing, Type } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { insidePositionFor, layoutCanvas } from '@/lib/explore-layout';
import {
  availableIn,
  hasNextRound,
  postForRound,
  roundComplete,
  unseenCount,
  type ExploreSession,
} from '@/lib/explore-session';
import { timeAgo } from '@/lib/format';
import { useSerif, useTheme } from '@/lib/theme';
import type { Profile } from '@/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

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
/** How long the circle takes to draw itself when the space opens. */
const DRAW_MS = 700;
/** Nodes start settling in once the circle is mostly drawn. */
const NODES_AFTER_MS = 450;

/** A short rule that draws itself once, marking an ending. */
function EndingRule({ color }: { color: string }) {
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(reducedMotion ? 24 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    width.set(withTiming(24, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [reducedMotion, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  return <Animated.View style={[styles.endingRule, { backgroundColor: color }, style]} />;
}

/**
 * Explore as a space rather than a stream. The reader's circle draws itself
 * as a single hairline; the people they follow sit inside it as small marks,
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
  const { t, tp } = useI18n();
  const serif = useSerif();
  const reducedMotion = useReducedMotion();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [asList, setAsList] = useState(false);

  // The circle draws on (stroke dash offset from full circumference to 0).
  const drawn = useSharedValue(reducedMotion ? 1 : 0);
  // A line from the reader to the person they just opened, briefly.
  const reachX = useSharedValue(0);
  const reachY = useSharedValue(0);
  const reachProgress = useSharedValue(0);
  const reachOpacity = useSharedValue(0);
  // One disturbance shared by every node (see PersonNode).
  const disturbance: Disturbance = {
    x: useSharedValue(-9999),
    y: useSharedValue(-9999),
    dx: useSharedValue(0),
    dy: useSharedValue(0),
    strength: useSharedValue(0),
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  useEffect(() => {
    if (reducedMotion || box.width === 0) return;
    drawn.set(withTiming(1, { duration: DRAW_MS, easing: Easing.inOut(Easing.cubic) }));
    // Only when the space first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.width > 0]);

  const insideSet = new Set(insideIds);
  // People followed during this session stay where they are (the session is
  // a snapshot); their own node becomes the mark, so they are not drawn twice.
  const layout = layoutCanvas(
    session.people.map((p) => p.id),
    insideIds.filter((id) => !session.people.some((p) => p.id === id)),
    box,
  );
  const { center, boundaryRadius } = layout;
  const circumference = 2 * Math.PI * boundaryRadius;

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - drawn.value),
  }));
  const lineProps = useAnimatedProps(() => ({
    x2: center.x + (reachX.value - center.x) * reachProgress.value,
    y2: center.y + (reachY.value - center.y) * reachProgress.value,
    opacity: reachOpacity.value,
  }));

  /** Reaching out: a line runs from you to them and fades as the sheet opens. */
  const openPerson = (personId: string) => {
    const point = layout.outside.find((p) => p.id === personId);
    if (point && !reducedMotion) {
      reachX.set(point.x);
      reachY.set(point.y);
      reachProgress.set(0);
      reachOpacity.set(1);
      reachProgress.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
      reachOpacity.set(
        withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 350 })),
      );
    }
    onOpenPerson(personId);
  };

  const remaining = unseenCount(session);
  const complete = roundComplete(session);
  const more = hasNextRound(session);
  const available = availableIn(session).length;
  const insideCount = insideIds.length;

  const insideLine =
    insideCount === 0 ? t('explore.circleEmpty') : tp('explore.inCircle', insideCount);

  const footer = complete ? (
    <View style={styles.ending}>
      <EndingRule color={colors.textTertiary} />
      <Text style={[styles.endingTitle, serif.regular, { color: colors.text }]}>
        {session.round === 1 ? t('explore.everyoneRound1') : t('explore.everyoneAgain')}
      </Text>
      {more ? (
        <Button title={t('explore.oneMoreFromEach')} variant="outline" compact onPress={onNextRound} />
      ) : (
        <Text style={[styles.endingDetail, { color: colors.textSecondary }]}>
          {t('explore.nothingMore')}
        </Text>
      )}
    </View>
  ) : (
    <View style={styles.status}>
      <Text style={[styles.statusLine, { color: colors.textSecondary }]}>
        {tp('explore.stillToMeet', remaining)}
        {session.round > 1 ? `  ·  ${t('explore.round', { n: session.round })}` : ''}
      </Text>
      <Text style={[styles.statusLine, { color: colors.textTertiary }]}>{insideLine}</Text>
    </View>
  );

  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={asList ? t('explore.showAsSpace') : t('explore.showAsList')}
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
                  post
                    ? seen
                      ? t('explore.state.seen')
                      : t('explore.state.unseen')
                    : t('explore.state.noMore')
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
                    {post ? t('explore.latestPost', { time: timeAgo(post.created_at) }) : t('explore.noMorePosts')}
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

  return (
    <View style={styles.fill}>
      {toggle}
      <View style={styles.canvas} onLayout={handleLayout}>
        {box.width > 0 ? (
          <>
            {/* The circle itself: one hairline that draws on, no fill, no meaning in radius. */}
            <Svg
              width={box.width}
              height={box.height}
              style={StyleSheet.absoluteFill}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <AnimatedCircle
                cx={center.x}
                cy={center.y}
                r={boundaryRadius}
                stroke={colors.border}
                strokeWidth={StyleSheet.hairlineWidth * 2}
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={circleProps}
                fill="none"
                // Start drawing from the top.
                transform={`rotate(-90 ${center.x} ${center.y})`}
              />
              <AnimatedLine
                x1={center.x}
                y1={center.y}
                stroke={colors.tint}
                strokeWidth={1}
                strokeLinecap="round"
                animatedProps={lineProps}
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
              <Avatar url={me?.avatar_url ?? null} name={me?.display_name ?? t('common.you')} size={CENTER_SIZE} />
            </View>

            {layout.outside.map((point, index) => {
              const person = session.people.find((p) => p.id === point.id);
              if (!person) return null;
              const post = postForRound(person, session.round);
              const followed = insideSet.has(person.id);
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
                    at={{ x: point.x, y: point.y }}
                    seen={session.seen.has(person.id)}
                    postedAt={post?.created_at ?? null}
                    onPress={post ? () => openPerson(person.id) : null}
                    moveTo={followed ? insidePositionFor(person.id, center, boundaryRadius) : null}
                    appearDelay={NODES_AFTER_MS + 40 * index}
                    disturbance={disturbance}
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
  endingRule: {
    height: 1,
    marginBottom: Spacing.xs,
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
