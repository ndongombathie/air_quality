import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS, formatRelativeTime, type Station } from '@senair/core';
import { AqiBadge, LevelChip, PressableScale } from '@/shared/ui';
import { pollutantLabel } from '@/shared/format/display';
import { COLORS, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

/** Ligne station : IQA en anneau, niveau, statut, fraîcheur. Sert aussi de liste de repli accessible. */
export function StationCard({ station, onPress }: { station: Station; onPress: () => void }) {
  const latest = station.latest ?? null;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${station.name}, ${station.zoneName}, ${STATION_STATUS_LABELS[station.status]}`}
      accessibilityHint="Ouvre le détail de la station"
      style={styles.card} pressedStyle={styles.pressed}
    >
      <AqiBadge aqi={latest?.aqi} level={latest?.level} />
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={1}>
          {station.name}
        </Text>
        <View style={styles.meta}>
          <LevelChip level={latest?.level ?? null} short />
          <Text style={styles.sub}>{pollutantLabel(latest?.dominantPollutant)}</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {station.zoneName}, {STATION_TYPE_LABELS[station.type].toLowerCase()}
          {station.status !== 'online' ? `, ${STATION_STATUS_LABELS[station.status].toLowerCase()}` : ''}, {formatRelativeTime(latest?.observedAt ?? station.lastObservedAt)}
        </Text>
      </View>
      <ChevronRight size={18} color={COLORS.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH_TARGET,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  pressed: { backgroundColor: COLORS.background },
  texts: { flex: 1, gap: SPACING.xs },
  name: { ...TYPE.bodySemibold, color: COLORS.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sub: { ...TYPE.caption, color: COLORS.textMuted },
});
