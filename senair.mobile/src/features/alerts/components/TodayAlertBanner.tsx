import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BellRing, ChevronRight } from 'lucide-react-native';
import { AQI_LEVELS } from '@senair/core';
import { LevelChip, PressableScale } from '@/shared/ui';
import { COLORS, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { useActiveAlert } from '../hooks/useAlerts';

/** Alerte du jour (si une alerte est en cours) : carte blanche, liseré et puce du niveau. */
export function TodayAlertBanner() {
  const { data: alert } = useActiveAlert();
  if (!alert) return null;
  const level = AQI_LEVELS[alert.severity];
  return (
    <PressableScale
      onPress={() => router.push('/alerts')}
      accessibilityRole="button"
      accessibilityLabel={`Alerte en cours, niveau ${level.label} : ${alert.title}`}
      accessibilityHint="Ouvre l'historique des alertes"
      style={styles.banner} pressedStyle={styles.pressed}
    >
      <View style={[styles.accent, { backgroundColor: level.color }]} />
      <View style={[styles.icon, { backgroundColor: level.surface }]}>
        <BellRing size={18} color={COLORS.text} strokeWidth={2} />
      </View>
      <View style={styles.texts}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>Alerte en cours</Text>
          <LevelChip level={alert.severity} short />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {alert.title}
        </Text>
      </View>
      <ChevronRight size={18} color={COLORS.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingLeft: SPACING.lg + SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minHeight: TOUCH_TARGET,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  pressed: { backgroundColor: COLORS.background },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: SPACING.xs },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  kicker: { ...TYPE.overline, color: COLORS.textMuted },
  title: { ...TYPE.smallSemibold, color: COLORS.text },
});
