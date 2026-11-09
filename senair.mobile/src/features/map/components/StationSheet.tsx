import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { ChevronRight, X } from 'lucide-react-native';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS, type Station } from '@senair/core';
import { AqiBadge, Button, FreshnessLine, LevelChip, PressableScale } from '@/shared/ui';
import { pollutantLabel } from '@/shared/format/display';
import { COLORS, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

interface StationSheetProps {
  station: Station;
  bottomInset: number;
  onClose: () => void;
  onOpen: () => void;
}

/** Panneau inférieur qui glisse quand on touche une station sur la carte. */
export function StationSheet({ station, bottomInset, onClose, onOpen }: StationSheetProps) {
  const reduced = useReducedMotion();
  const latest = station.latest ?? null;
  return (
    <Animated.View
      entering={reduced ? undefined : SlideInDown.springify().damping(20)}
      exiting={reduced ? undefined : SlideOutDown.duration(200)}
      style={[styles.sheet, { paddingBottom: bottomInset + SPACING.lg }]}
      accessibilityViewIsModal={false}
      accessibilityLabel={`Station ${station.name}`}
    >
      <View style={styles.handle} />
      <View style={styles.row}>
        <AqiBadge aqi={latest?.aqi} level={latest?.level} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={2}>
            {station.name}
          </Text>
          <Text style={styles.sub}>
            {station.zoneName}, {STATION_TYPE_LABELS[station.type].toLowerCase()}, {STATION_STATUS_LABELS[station.status].toLowerCase()}
          </Text>
        </View>
        <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le panneau" scaleTo={0.9} style={styles.close}>
          <X size={18} color={COLORS.textSecondary} />
        </PressableScale>
      </View>
      <View style={styles.meta}>
        <LevelChip level={latest?.level ?? null} />
        <Text style={styles.sub}>Dominant : {pollutantLabel(latest?.dominantPollutant)}</Text>
      </View>
      {latest ? <FreshnessLine freshness={latest.freshness} observedAt={latest.observedAt} /> : null}
      <Button label="Voir le détail de la station" onPress={onOpen} icon={<ChevronRight size={18} color={COLORS.onPrimary} />} style={styles.button} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
    ...SHADOWS.raised,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginBottom: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  texts: { flex: 1, gap: SPACING.xxs },
  name: { ...TYPE.h3, color: COLORS.text },
  sub: { ...TYPE.caption, color: COLORS.textMuted },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  button: { marginTop: SPACING.xs },
});
