import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

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

  const background =
    variant === 'primary'
      ? colors.tint
      : variant === 'destructive'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';
  const textColor =
    variant === 'primary' || variant === 'destructive' ? colors.onTint : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.full,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.textTertiary : 'transparent',
          opacity: blocked ? 0.5 : pressed ? 0.75 : 1,
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
    </Pressable>
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
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
  },
  compact: {
    minHeight: 36,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'flex-start',
  },
  label: Type.button,
  compactLabel: Type.captionStrong,
});
