import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { PressableScale } from './PressableScale';

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: (active: boolean) => ReactNode;
  hint?: string;
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Onglets côte à côte sur fond blanc ; l'onglet actif est surligné en bleu ciel. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <PressableScale
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            accessibilityHint={tab.hint}
            haptics="light"
            style={[styles.item, active && styles.itemActive]}
          >
            {tab.icon?.(active)}
            <Text style={[styles.text, active && styles.textActive]}>{tab.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Couleur d'icône assortie à l'état de l'onglet. */
export function tabIconColor(active: boolean): string {
  return active ? COLORS.primaryText : COLORS.textMuted;
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  item: {
    flex: 1,
    minHeight: TOUCH_TARGET - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + SPACING.xxs,
    borderRadius: RADIUS.sm,
  },
  itemActive: { backgroundColor: COLORS.primarySoft },
  text: { ...TYPE.smallMedium, color: COLORS.textMuted },
  textActive: {
    fontFamily: TYPE.smallSemibold.fontFamily,
    color: COLORS.primaryText,
  },
});
