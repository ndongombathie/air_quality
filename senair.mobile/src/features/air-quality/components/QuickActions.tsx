import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BellRing, CalendarClock, HeartPulse, Map, type LucideProps } from 'lucide-react-native';
import { PressableScale } from '@/shared/ui';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';

export interface QuickAction {
  key: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
}

export const QUICK_ACTION_ICONS = { map: Map, forecasts: CalendarClock, health: HeartPulse, alerts: BellRing } as const;

/** Rangée d'actions rapides : 4 tuiles avec icône et libellé. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, Icon, onPress }) => (
        <PressableScale key={key} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} haptics="light" scaleTo={0.94} style={styles.tile}>
          <View style={styles.icon}>
            <Icon size={22} color={COLORS.primaryText} strokeWidth={2} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 92,
    ...SHADOWS.card,
  },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { ...TYPE.captionMedium, color: COLORS.text, textAlign: 'center' },
});
