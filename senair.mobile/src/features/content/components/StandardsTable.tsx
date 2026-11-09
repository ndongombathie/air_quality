import { StyleSheet, Text, View } from 'react-native';
import { MISSING_VALUE, POLLUTANT_CODES, POLLUTANTS, REFERENCE_LABELS, REFERENCE_THRESHOLDS, formatMeasure, type ReferenceStandard } from '@senair/core';
import { Card } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';

const STANDARDS: ReferenceStandard[] = ['WHO_2021', 'NS_05_062'];

function cell(pollutant: string, reference: ReferenceStandard): string {
  const rows = REFERENCE_THRESHOLDS.filter((t) => t.pollutant === pollutant && t.reference === reference);
  if (rows.length === 0) return MISSING_VALUE;
  return rows.map((t) => `${formatMeasure(t.value)} ${t.unit} (${t.period === '1y' ? 'an' : t.period})`).join('\n');
}

/** Comparaison pédagogique OMS 2021 / NS 05-062 (référentiel publié, @senair/core). */
export function StandardsTable() {
  return (
    <Card style={styles.card}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cellPollutant, styles.headText]}>Polluant</Text>
        {STANDARDS.map((s) => (
          <Text key={s} style={[styles.cell, styles.headText]}>
            {REFERENCE_LABELS[s]}
          </Text>
        ))}
      </View>
      {POLLUTANT_CODES.map((code) => (
        <View
          key={code}
          style={styles.row}
          accessible
          accessibilityLabel={`${POLLUTANTS[code].name} : ${STANDARDS.map((s) => `${REFERENCE_LABELS[s]} ${cell(code, s)}`).join(' ; ')}`}
        >
          <Text style={styles.cellPollutant}>{POLLUTANTS[code].formula}</Text>
          {STANDARDS.map((s) => (
            <Text key={s} style={styles.cell}>
              {cell(code, s)}
            </Text>
          ))}
        </View>
      ))}
      <Text style={styles.note}>
        Valeurs de référence publiées. Les seuils d'alerte effectifs sont paramétrés par l'autorité sanitaire.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: SPACING.sm },
  row: { flexDirection: 'row', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  head: { borderBottomWidth: 1 },
  headText: { fontFamily: TYPE.smallMedium.fontFamily, color: COLORS.textSecondary },
  cellPollutant: { ...TYPE.smallMedium, color: COLORS.text, width: 64 },
  cell: { ...TYPE.small, color: COLORS.text, flex: 1 },
  note: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: SPACING.sm },
});
