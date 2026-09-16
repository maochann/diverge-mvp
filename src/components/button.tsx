import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Tappable } from '@/components/tappable';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  /** Smaller, content-sized button for inline placement. */
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const blocked = disabled || loading;

  // Primary is ink on paper: the accent is kept for selection and links.
  const background =
    variant === 'primary'
      ? colors.text
      : variant === 'destructive'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? colors.background
      : variant === 'destructive'
        ? '#FFFFFF'
        : colors.text;

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={onPress}
      disabled={blocked}
      style={[
        styles.base,
        compact ? styles.compact : styles.full,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.border : 'transparent',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[compact ? styles.compactLabel : styles.label, { color: textColor }]}>
          {title}
        </Text>
      )}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: {
    minHeight: 46,
    paddingHorizontal: Spacing.lg,
  },
  compact: {
    minHeight: 34,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  label: Type.button,
  compactLabel: Type.captionStrong,
});
