import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ForkLine } from '@/components/fork-line';
import { FEED_INTENTS, type FeedIntent } from '@/constants/feed';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface FeedIntentPickerProps {
  value: FeedIntent;
  onChange: (intent: FeedIntent) => void;
}

/**
 * Three words, one of them marked with a fork. Picking one is where the
 * feed diverges — a new reading session, not a filter — so the mark is the
 * app's only motif rather than a highlighted pill.
 */
export function FeedIntentPicker({ value, onChange }: FeedIntentPickerProps) {
  const { colors } = useTheme();
  const selected = FEED_INTENTS.find((o) => o.key === value) ?? FEED_INTENTS[0];

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
              onPress={() => onChange(option.key)}
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
              <View style={styles.mark}>
                {active ? <ForkLine width={28} color={colors.tint} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.description, { color: colors.textTertiary }]}>
        {selected.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'flex-end',
    gap: 2,
  },
  label: {
    ...Type.heading,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
  mark: {
    height: 10,
    justifyContent: 'flex-end',
  },
  description: Type.caption,
  pressed: {
    opacity: 0.6,
  },
});
