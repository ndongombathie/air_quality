import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ZoneRanking } from '@senair/core';
import { AqiBadge, LevelChip, PressableScale } from '@/shared/ui';
import { useMotion } from '@/shared/motion/useMotion';
import { pollutantLabel } from '@/shared/format/display';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';

/** « Quartiers à surveiller » : carrousel des zones les plus exposées (classement fourni par l'API). */
export function ZoneCarousel({ zones, onOpen }: { zones: ZoneRanking[]; onOpen: () => void }) {
  const motion = useMotion();
  if (zones.length === 0) return <Text style={styles.empty}>Classement indisponible.</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} snapToInterval={176 + SPACING.md} decelerationRate="fast">
      {zones.map((zone, i) => (
        <Animated.View key={zone.zoneId} entering={motion.enter(i)}>
          <PressableScale
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. ${zone.zoneName}, polluant dominant ${pollutantLabel(zone.dominantPollutant)}`}
            accessibilityHint="Ouvre la carte"
            style={styles.card}
          >
            <View style={styles.top}>
              <Text style={styles.rank}>{i + 1}</Text>
              <AqiBadge aqi={zone.aqi} level={zone.level} size="sm" />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {zone.zoneName}
            </Text>
            <LevelChip level={zone.level} short />
            <Text style={styles.sub}>Dominant : {pollutantLabel(zone.dominantPollutant)}</Text>
          </PressableScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACING.md, paddingVertical: SPACING.xs, paddingRight: SPACING.lg },
  card: {
    width: 176,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rank: { ...TYPE.overline, color: COLORS.textMuted },
  name: { ...TYPE.bodySemibold, color: COLORS.text },
  sub: { ...TYPE.caption, color: COLORS.textMuted },
  empty: { ...TYPE.body, color: COLORS.textSecondary },
});
