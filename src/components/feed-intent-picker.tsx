import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ForkLine } from '@/components/fork-line';
import { FEED_INTENTS, type FeedIntent } from '@/constants/feed';
import { Motion, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface FeedIntentPickerProps {
  value: FeedIntent;
  onChange: (intent: FeedIntent) => void;
}

const MARK_WIDTH = 28;

/**
 * Three words, one of them marked with a fork. Picking one is where the
 * feed diverges — a new reading session, not a filter — so the mark is the
 * app's only motif rather than a highlighted pill, and it slides to the new
 * word instead of jumping.
 */
export function FeedIntentPicker({ value, onChange }: FeedIntentPickerProps) {
  const { colors } = useTheme();
  const [tabX, setTabX] = useState<Partial<Record<FeedIntent, number>>>({});
  const markX = useSharedValue(0);
  const markOpacity = useSharedValue(0);

  const target = tabX[value];
  useEffect(() => {
    if (target === undefined) return;
    if (markOpacity.get() === 0) {
      // First layout: place without travelling.
      markX.set(target);
      markOpacity.set(withTiming(1, { duration: Motion.base }));
    } else {
      markX.set(withSpring(target, Motion.spring));
    }
  }, [target, markX, markOpacity]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: markX.value }],
    opacity: markOpacity.value,
  }));

  const remember = (key: FeedIntent) => (event: LayoutChangeEvent) => {
    const { x } = event.nativeEvent.layout;
    setTabX((current) => (current[key] === x ? current : { ...current, [key]: x }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {FEED_INTENTS.map((option) => {
          const active = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              onPress={() => onChange(option.key)}
              onLayout={remember(option.key)}
              hitSlop={6}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.text : colors.textTertiary },
                  active && styles.labelActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.mark, markStyle]} pointerEvents="none">
          <ForkLine width={MARK_WIDTH} color={colors.tint} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingBottom: 12,
  },
  tab: {
    minHeight: 32,
    justifyContent: 'flex-end',
  },
  label: {
    ...Type.heading,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
  mark: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 10,
  },
  pressed: {
    opacity: 0.6,
  },
});
