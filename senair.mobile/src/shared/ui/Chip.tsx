import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Pastille de couleur optionnelle (toujours accompagnée du libellé). */
  dotColor?: string;
  accessibilityLabel?: string;
}

/** Puce de filtre : blanche, active sur fond sky100 avec texte sky700. */
export function Chip({ label, selected, onPress, dotColor, accessibilityLabel }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, selected && styles.selected]}
      pressedStyle={!selected && styles.pressed}
      scaleTo={0.95}
      haptics="selection"
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: SPACING.md + SPACING.xxs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
  },
  selected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.selectedBorder },
  pressed: { backgroundColor: COLORS.background },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...TYPE.smallMedium, color: COLORS.textSecondary },
  labelSelected: { fontFamily: TYPE.smallSemibold.fontFamily, color: COLORS.primaryText },
});
