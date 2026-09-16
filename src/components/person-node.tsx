import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Motion, Spacing, Type } from '@/constants/theme';
import { fractionFor } from '@/lib/explore-layout';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { PostAuthor } from '@/types';

interface PersonNodeProps {
  id: string;
  author: PostAuthor;
  size: number;
  /** Whether the reader has opened this person's post in the current round. */
  seen: boolean;
  /** When their post for this round was written; read out for VoiceOver. */
  postedAt: string | null;
  /** Null when they have nothing to show this round (dimmed, not tappable). */
  onPress: (() => void) | null;
}

/** How far a node can be nudged from its place before it springs back. */
const NUDGE_LIMIT = 12;
/** How much of the finger's travel the node follows (resistance). */
const NUDGE_FOLLOW = 0.4;
/** Idle drift: a couple of points, over several seconds, out of phase per person. */
const DRIFT = 2;

/**
 * One person on the Explore canvas. Everyone in a ring is the same size;
 * the only thing that changes is whether the reader has opened their post.
 *
 * The node breathes very slightly and gives a little under the finger, then
 * returns — alive and tactile without ever moving from its place.
 */
export function PersonNode({ id, author, size, seen, postedAt, onPress }: PersonNodeProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const disabled = onPress === null;
  const quiet = seen || disabled;
  const state = disabled ? 'no more posts' : seen ? 'seen' : 'not yet seen';
  const when = postedAt ? `, latest post ${timeAgo(postedAt)}` : '';

  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const scale = useSharedValue(1);
  const ringOpacity = useSharedValue(quiet ? 0 : 1);
  const bodyOpacity = useSharedValue(quiet ? 0.55 : 1);

  // Idle breathing: each person has their own period and phase from the hash.
  useEffect(() => {
    if (reducedMotion || quiet) {
      driftX.value = withTiming(0, { duration: Motion.slow });
      driftY.value = withTiming(0, { duration: Motion.slow });
      return;
    }
    const f = fractionFor(id);
    const periodX = 7000 + f * 2000;
    const periodY = 8000 + (1 - f) * 2000;
    driftX.value = withRepeat(
      withTiming(DRIFT * (f > 0.5 ? 1 : -1), { duration: periodX, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    driftY.value = withRepeat(
      withTiming(DRIFT * (f > 0.25 && f < 0.75 ? -1 : 1), {
        duration: periodY,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [id, quiet, reducedMotion, driftX, driftY]);

  // Seen: the ring fades and the node settles back.
  useEffect(() => {
    ringOpacity.value = withTiming(quiet ? 0 : 1, { duration: Motion.slow });
    bodyOpacity.value = withTiming(quiet ? 0.55 : 1, { duration: Motion.slow });
  }, [quiet, ringOpacity, bodyOpacity]);

  const open = () => onPress?.();

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(8)
    .onBegin(() => {
      scale.value = withTiming(0.96, { duration: Motion.fast });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, Motion.spring);
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
      nudgeX.value = dx * k;
      nudgeY.value = dy * k;
    })
    .onFinalize(() => {
      nudgeX.value = withSpring(0, Motion.spring);
      nudgeY.value = withSpring(0, Motion.spring);
      scale.value = withSpring(1, Motion.spring);
    });

  const gesture = Gesture.Race(nudge, tap);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [
      { translateX: driftX.value + nudgeX.value },
      { translateY: driftY.value + nudgeY.value },
      { scale: scale.value },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));

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
        <Text
          style={[styles.name, { color: quiet ? colors.textTertiary : colors.text }]}
          numberOfLines={1}
        >
          {author.display_name}
        </Text>
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
