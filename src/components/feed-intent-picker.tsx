import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FEED_INTENTS, type FeedIntent } from '@/constants/feed';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface FeedIntentPickerProps {
  value: FeedIntent;
  onChange: (intent: FeedIntent) => void;
}

/**
 * Small row at the top of the feed where the reader says what they want.
 * Deliberately quiet: a caption, three chips, one line about the choice.
 */
export function FeedIntentPicker({ value, onChange }: FeedIntentPickerProps) {
  const { colors } = useTheme();
  const selected = FEED_INTENTS.find((o) => o.key === value) ?? FEED_INTENTS[0];

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <Text style={[styles.question, { color: colors.textSecondary }]}>
        What kind of feed do you want right now?
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {FEED_INTENTS.map((option) => {
          const active = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.text : colors.surface,
                  borderColor: active ? colors.text : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[styles.chipLabel, { color: active ? colors.background : colors.text }]}
              >
                {option.label}
              </Text>
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  question: Type.caption,
  chips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipLabel: Type.captionStrong,
  description: Type.caption,
});
