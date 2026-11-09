import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AQI_SCALE } from '@senair/core';
import { COLORS, SPACING, TYPE } from '@/theme';

/** Légende des niveaux IQA (point de couleur + libellé + bornes). */
export function AqiLegend() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row} accessibilityLabel="Légende des niveaux d'IQA">
      {AQI_SCALE.map((level) => (
        <View key={level.id} style={styles.item}>
          <View style={[styles.dot, { borderColor: level.color }]} />
          <Text style={styles.text}>
            {level.shortLabel} <Text style={styles.range}>{Number.isFinite(level.max) ? `${level.min} à ${level.max}` : `${level.min} et plus`}</Text>
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Ne s'étire pas dans un parent flexible (la carte garde toute la hauteur).
  scroll: { flexGrow: 0 },
  row: { gap: SPACING.lg, paddingVertical: SPACING.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + SPACING.xxs },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: COLORS.surface },
  text: { ...TYPE.captionMedium, color: COLORS.textSecondary },
  range: { ...TYPE.caption, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
});
