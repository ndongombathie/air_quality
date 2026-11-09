import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={COLORS.textMuted}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  label: { ...TYPE.smallSemibold, color: COLORS.text, marginBottom: SPACING.xs + SPACING.xxs },
  input: {
    ...TYPE.body,
    minHeight: TOUCH_TARGET + 4,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md + SPACING.xxs,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  inputFocused: { borderColor: COLORS.focus, borderWidth: 2, paddingHorizontal: SPACING.md + 1 },
  inputError: { borderColor: COLORS.danger },
  error: { ...TYPE.small, color: COLORS.danger, marginTop: SPACING.xs },
  hint: { ...TYPE.small, color: COLORS.textMuted, marginTop: SPACING.xs },
});
