import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Motion } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How far the reader pulls before a refresh is committed, in points. */
export const PULL_THRESHOLD = 72;
const WIDTH = 36;
const HEIGHT = 12;
const SPLIT = WIDTH * 0.45;
const PATH = `M0 ${HEIGHT - 1} H${SPLIT} L${SPLIT + 7} 1 H${WIDTH}`;
// Long enough to cover the path; the dash offset does the drawing.
const LENGTH = 80;

interface PullForkProps {
  /** 0 at rest, 1 at the threshold, may exceed 1 while over-pulled. */
  progress: SharedValue<number>;
  refreshing: boolean;
  color: string;
  /** Distance from the top of the list's container (the safe area, when there is no header). */
  top?: number;
}

/**
 * The pull-to-refresh indicator: as the reader pulls, the fork draws
 * itself; once released past the threshold it breathes until the new
 * session arrives. No spinner — the same mark as everywhere the feed branches.
 */
export function PullFork({ progress, refreshing, color, top = 0 }: PullForkProps) {
  // When the pull commits, the fork stretches sideways and vanishes: the
  // branch has been taken. 0 = at rest, 1 = fully stretched and gone.
  const release = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      release.set(0);
      release.set(withTiming(1, { duration: Motion.slow, easing: Easing.out(Easing.cubic) }));
    } else {
      release.set(0);
    }
  }, [refreshing, release]);

  const pathProps = useAnimatedProps(() => {
    const p = refreshing ? 1 : Math.min(1, Math.max(0, progress.value));
    return { strokeDashoffset: LENGTH * (1 - p) };
  });
  const containerStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    if (refreshing) {
      return {
        opacity: 1 - release.value,
        transform: [{ translateY: 0 }, { scaleX: 1 + release.value * 3 }],
      };
    }
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * -6 }, { scaleX: 1 }],
    };
  });

  return (
    <Animated.View
      style={[styles.container, { top: top + 8 }, containerStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.mark}>
        <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <AnimatedPath
            d={PATH}
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${LENGTH} ${LENGTH}`}
            animatedProps={pathProps}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  mark: {
    height: HEIGHT,
  },
});
