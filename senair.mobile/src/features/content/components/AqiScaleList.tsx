import { StyleSheet, Text, View } from 'react-native';
import { AQI_SCALE } from '@senair/core';
import { Card } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';

/** Échelle IQA : fine barre de couleur, bornes « 0 à 50 », libellé et impact sanitaire. */
export function AqiScaleList() {
  return (
    <Card style={styles.card}>
      {AQI_SCALE.map((level, i) => {
        const range = Number.isFinite(level.max) ? `${level.min} à ${level.max}` : `${level.min} et plus`;
        return (
          <View key={level.id} style={[styles.row, i > 0 && styles.separator]} accessible accessibilityLabel={`${range} : ${level.label}. ${level.healthImpact}`}>
            <View style={[styles.bar, { backgroundColor: level.color }]} />
            <View style={styles.texts}>
              <View style={styles.titleRow}>
                <Text style={styles.label}>{level.label}</Text>
                <Text style={styles.range}>{range}</Text>
              </View>
              <Text style={styles.impact}>{level.healthImpact}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.md, paddingVertical: SPACING.md },
  separator: { borderTopWidth: 1, borderTopColor: COLORS.border },
  bar: { width: 4, borderRadius: 2 },
  texts: { flex: 1, gap: SPACING.xxs },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  label: { ...TYPE.smallSemibold, color: COLORS.text, flex: 1 },
  range: { ...TYPE.smallSemibold, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  impact: { ...TYPE.caption, color: COLORS.textMuted },
});
