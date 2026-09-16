import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Motion, Spacing, Type } from '@/constants/theme';
import { fractionFor } from '@/lib/explore-layout';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { PostAuthor } from '@/types';

/**
 * A disturbance travelling through the canvas: where a node is being
 * nudged, how far, and how strongly (0 = settled). Every node reads it and
 * sways a little in proportion to how close it is — like a mobile.
 */
export interface Disturbance {
  x: SharedValue<number>;
  y: SharedValue<number>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  strength: SharedValue<number>;
}

interface PersonNodeProps {
  id: string;
  author: PostAuthor;
  size: number;
  /** Where the node sits on the canvas (for the ripple). */
  at: { x: number; y: number };
  /** Whether the reader has opened this person's post in the current round. */
  seen: boolean;
  /** When their post for this round was written; read out for VoiceOver. */
  postedAt: string | null;
  /** Null when they have nothing to show this round (dimmed, not tappable). */
  onPress: (() => void) | null;
  /**
   * The reader followed this person during the session: the node drifts
   * across the boundary to this point and becomes a mark inside the circle.
   */
  moveTo?: { x: number; y: number } | null;
  /** Stagger for the settle-in when the canvas first appears. */
  appearDelay?: number;
  disturbance: Disturbance;
}

/** How far a node can be nudged from its place before it springs back. */
const NUDGE_LIMIT = 12;
/** How much of the finger's travel the node follows (resistance). */
const NUDGE_FOLLOW = 0.4;
/** Idle breathing: a few points, over a few seconds, out of phase per person. */
const DRIFT = 5;
/** How far a nudge is felt by neighbours, in points. */
const RIPPLE_REACH = 170;
/** Size of the mark a person becomes once inside the circle. */
const INSIDE_MARK = 6;

/**
 * One person on the Explore canvas. Everyone in a ring is the same size;
 * the only thing that changes is whether the reader has opened their post.
 *
 * The node breathes, gives under the finger, sways when a neighbour is
 * nudged, and always returns to its place — alive and tactile without ever
 * moving on its own account.
 */
export function PersonNode({
  id,
  author,
  size,
  at,
  seen,
  postedAt,
  onPress,
  moveTo = null,
  appearDelay = 0,
  disturbance,
}: PersonNodeProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const followed = moveTo !== null;
  const disabled = onPress === null || followed;
  const quiet = seen || disabled;
  const state = followed
    ? 'now in your circle'
    : disabled
      ? 'no more posts'
      : seen
        ? 'seen'
        : 'not yet seen';
  const when = postedAt ? `, latest post ${timeAgo(postedAt)}` : '';

  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.92);
  const ringOpacity = useSharedValue(quiet ? 0 : 1);
  const ringScale = useSharedValue(1);
  const bodyOpacity = useSharedValue(reducedMotion ? (quiet ? 0.55 : 1) : 0);
  const nameOpacity = useSharedValue(1);
  // Crossing into the circle: travel and shrink.
  const travelX = useSharedValue(0);
  const travelY = useSharedValue(0);
  const shrink = useSharedValue(1);

  // Settle in: each person arrives a beat after the last, from slightly small.
  useEffect(() => {
    if (reducedMotion) return;
    scale.set(withDelay(appearDelay, withSpring(1, Motion.spring)));
    bodyOpacity.set(
      withDelay(appearDelay, withTiming(quiet ? 0.55 : 1, { duration: Motion.slow })),
    );
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle breathing: each person has their own period and phase from the hash.
  useEffect(() => {
    if (reducedMotion || quiet) {
      driftX.set(withTiming(0, { duration: Motion.slow }));
      driftY.set(withTiming(0, { duration: Motion.slow }));
      return;
    }
    const f = fractionFor(id);
    const periodX = 4000 + f * 3000;
    const periodY = 4500 + (1 - f) * 2500;
    driftX.set(
      withRepeat(
        withTiming(DRIFT * (f > 0.5 ? 1 : -1), {
          duration: periodX,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    driftY.set(
      withRepeat(
        withTiming(DRIFT * (f > 0.25 && f < 0.75 ? -1 : 1), {
          duration: periodY,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, [id, quiet, reducedMotion, driftX, driftY]);

  // Seen: the ring fades and the node settles back.
  // Followed: the ring draws in, then the person crosses the boundary and
  // becomes a mark inside the circle — the world changed because you chose.
  useEffect(() => {
    if (followed && moveTo) {
      const dx = moveTo.x - at.x;
      const dy = moveTo.y - at.y;
      const slow = { duration: 700, easing: Easing.inOut(Easing.cubic) };
      ringScale.set(withTiming(0.6, { duration: Motion.slow, easing: Easing.out(Easing.cubic) }));
      ringOpacity.set(withDelay(Motion.base, withTiming(0, { duration: Motion.slow })));
      nameOpacity.set(withTiming(0, { duration: Motion.base }));
      travelX.set(withDelay(Motion.slow, withTiming(dx, slow)));
      travelY.set(withDelay(Motion.slow, withTiming(dy, slow)));
      shrink.set(withDelay(Motion.slow, withTiming(INSIDE_MARK / (size - 8), slow)));
      bodyOpacity.set(withDelay(Motion.slow, withTiming(0.7, slow)));
      return;
    }
    ringOpacity.set(withTiming(quiet ? 0 : 1, { duration: Motion.slow }));
    bodyOpacity.set(withTiming(quiet ? 0.55 : 1, { duration: Motion.slow }));
  }, [
    quiet,
    followed,
    moveTo,
    at.x,
    at.y,
    size,
    ringOpacity,
    ringScale,
    bodyOpacity,
    nameOpacity,
    travelX,
    travelY,
    shrink,
  ]);

  const open = () => onPress?.();

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(8)
    .onBegin(() => {
      scale.set(withTiming(0.96, { duration: Motion.fast }));
    })
    .onFinalize(() => {
      scale.set(withSpring(1, Motion.spring));
    })
    .onEnd(() => {
      runOnJS(open)();
    });

  const nudge = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(6)
    .onUpdate((e) => {
      const dx = e.translationX * NUDGE_FOLLOW;
      const dy = e.translationY * NUDGE_FOLLOW;
      const d = Math.hypot(dx, dy);
      const k = d > NUDGE_LIMIT ? NUDGE_LIMIT / d : 1;
      nudgeX.set(dx * k);
      nudgeY.set(dy * k);
      // Let the neighbours feel it.
      disturbance.x.set(at.x);
      disturbance.y.set(at.y);
      disturbance.dx.set(dx * k);
      disturbance.dy.set(dy * k);
      disturbance.strength.set(1);
    })
    .onFinalize(() => {
      nudgeX.set(withSpring(0, Motion.spring));
      nudgeY.set(withSpring(0, Motion.spring));
      scale.set(withSpring(1, Motion.spring));
      disturbance.strength.set(withSpring(0, Motion.spring));
    });

  const gesture = Gesture.Race(nudge, tap);

  const bodyStyle = useAnimatedStyle(() => {
    // Sway from a neighbour's nudge, fading with distance. The nudged node
    // itself already moves with the finger, so it ignores its own ripple.
    const ddx = at.x - disturbance.x.value;
    const ddy = at.y - disturbance.y.value;
    const dist = Math.hypot(ddx, ddy);
    const isSelf = dist < 1;
    const weight = isSelf ? 0 : Math.max(0, 1 - dist / RIPPLE_REACH) * disturbance.strength.value;
    const swayX = disturbance.dx.value * weight * 0.35;
    const swayY = disturbance.dy.value * weight * 0.35;
    return {
      opacity: bodyOpacity.value,
      transform: [
        { translateX: driftX.value + nudgeX.value + swayX + travelX.value },
        { translateY: driftY.value + nudgeY.value + swayY + travelY.value },
        { scale: scale.value * shrink.value },
      ],
    };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${author.display_name}, ${state}${when}`}
        accessibilityState={{ disabled }}
        style={[styles.node, { width: size + 28 }, bodyStyle]}
      >
        <View style={{ width: size, height: size }}>
          <Animated.View
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, borderColor: colors.tint },
              ringStyle,
            ]}
          />
          <View style={styles.avatar}>
            <Avatar url={author.avatar_url} name={author.display_name} size={size - 8} />
          </View>
        </View>
        <Animated.Text
          style={[styles.name, { color: quiet ? colors.textTertiary : colors.text }, nameStyle]}
          numberOfLines={1}
        >
          {author.display_name}
        </Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  node: {
    alignItems: 'center',
    gap: Spacing.xs + 1,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  avatar: {
    position: 'absolute',
    left: 4,
    top: 4,
  },
  name: {
    ...Type.micro,
    maxWidth: 84,
  },
});
