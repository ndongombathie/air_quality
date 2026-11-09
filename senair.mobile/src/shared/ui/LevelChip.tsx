import { StyleSheet, Text, View } from 'react-native';
import { AQI_LEVELS, type AqiLevel } from '@senair/core';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

/** Puce de niveau IQA : fond doux du niveau, bordure de sa couleur, texte foncé. */
export function LevelChip({ level, short = false }: { level: AqiLevel | null; short?: boolean }) {
  if (!level) {
    return (
      <View style={[styles.chip, styles.unknown]}>
        <Text style={styles.text}>Niveau indisponible</Text>
      </View>
    );
  }
  const info = AQI_LEVELS[level];
  return (
    <View style={[styles.chip, { backgroundColor: info.surface, borderColor: info.color }]}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <Text style={styles.text} numberOfLines={1}>
        {short ? info.shortLabel : info.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs + SPACING.xxs,
    paddingHorizontal: SPACING.sm + SPACING.xxs,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  unknown: { backgroundColor: COLORS.surfaceSubtle, borderColor: COLORS.borderStrong },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...TYPE.captionMedium, color: COLORS.text, flexShrink: 1 },
});
