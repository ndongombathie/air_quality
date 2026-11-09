import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import type { ReactNode } from 'react';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: COLORS.primaryStrong, fg: COLORS.onPrimary, border: COLORS.primaryStrong },
  secondary: { bg: COLORS.surface, fg: COLORS.primaryText, border: COLORS.borderStrong },
  ghost: { bg: 'transparent', fg: COLORS.primaryText, border: 'transparent' },
  danger: { bg: COLORS.surface, fg: COLORS.danger, border: COLORS.borderStrong },
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, accessibilityHint, style }: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[styles.base, { backgroundColor: palette.bg, borderColor: palette.border }, inactive && styles.disabled, style]}
      pressedStyle={variant === 'primary' ? styles.pressedPrimary : styles.pressed}
      haptics={variant === 'primary' ? 'light' : undefined}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  label: { ...TYPE.bodySemibold },
  pressed: { backgroundColor: COLORS.surfaceSubtle },
  pressedPrimary: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
