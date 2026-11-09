import { StyleSheet, Text, View } from 'react-native';
import { AUXILIARY_CODES, POLLUTANT_CODES, POLLUTANTS } from '@senair/core';
import { Card } from '@/shared/ui';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { COLORS, SPACING, TYPE } from '@/theme';

export function PollutantGuide() {
  const { isTablet } = useResponsive();
  return (
    <View style={[styles.grid, isTablet && styles.gridTablet]}>
      {[...POLLUTANT_CODES, ...AUXILIARY_CODES].map((code) => {
        const p = POLLUTANTS[code];
        return (
          <View key={code} style={isTablet ? styles.cellTablet : styles.cell}>
            <Card style={styles.card}>
              <Text style={styles.title} accessibilityRole="header">
                {p.formula} · {p.name}
              </Text>
              <Text style={styles.unit}>
                Unité : {p.unit} · {p.inAqi ? "Pris en compte dans l'IQA" : "Hors IQA (indicateur complémentaire)"}
              </Text>
              <Text style={styles.body}>{p.description}</Text>
              <Text style={styles.sources}>Sources : {p.sources}</Text>
            </Card>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {},
  gridTablet: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -SPACING.xs },
  cell: { marginBottom: SPACING.sm },
  cellTablet: { width: '50%', paddingHorizontal: SPACING.xs, marginBottom: SPACING.sm },
  card: { gap: 4 },
  title: { ...TYPE.h3, color: COLORS.text },
  unit: { ...TYPE.caption, color: COLORS.textSecondary },
  body: { ...TYPE.small, color: COLORS.text },
  sources: { ...TYPE.caption, color: COLORS.textSecondary },
});
