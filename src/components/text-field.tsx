import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    color: Colors.danger,
    fontSize: FontSize.sm,
  },
});
