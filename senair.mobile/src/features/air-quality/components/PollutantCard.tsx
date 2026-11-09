import { StyleSheet, Text, View } from 'react-native';
import { MEASURE_SOURCE_LABELS, PERIOD_LABELS, REFERENCE_LABELS, exceedanceRatio, formatMeasure, getPollutant, type AveragingPeriod, type Measure, type ReferenceStandard } from '@senair/core';
import { COLORS, SPACING, TYPE } from '@/theme';

export interface PollutantReference {
  value: number;
  unit: string;
  reference: ReferenceStandard;
  period: AveragingPeriod;
}

interface PollutantRowProps {
  measure: Measure;
  reference: PollutantReference | null;
  showSource?: boolean;
}

/** Ligne polluant : valeur mesurée, position par rapport au seuil (texte + barre fine), provenance. */
export function PollutantRow({ measure, reference, showSource }: PollutantRowProps) {
  const info = getPollutant(measure.code);
  const ratio = reference ? exceedanceRatio(measure.value, reference.value) : null;
  const status =
    ratio == null
      ? { label: 'Comparaison indisponible', color: COLORS.textMuted }
      : ratio > 1
        ? { label: `Au-dessus du seuil, ${formatMeasure(ratio, 1)} fois`, color: COLORS.danger }
        : { label: 'Sous le seuil', color: COLORS.success };

  return (
    <View style={styles.row} accessible accessibilityLabel={`${info?.name ?? measure.code} : ${formatMeasure(measure.value)} ${measure.unit}. ${status.label}.`}>
      <View style={styles.top}>
        <View style={styles.names}>
          <Text style={styles.formula}>{info?.formula ?? measure.code}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {info?.name ?? ''}
          </Text>
        </View>
        <Text style={styles.value}>
          {formatMeasure(measure.value)}
          <Text style={styles.unit}> {measure.unit}</Text>
        </Text>
      </View>
      {ratio != null ? (
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${Math.min(ratio * 50, 100)}%`, backgroundColor: status.color }]} />
          <View style={styles.marker} />
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        {reference ? (
          <Text style={styles.reference}>
            Seuil {REFERENCE_LABELS[reference.reference]} : {formatMeasure(reference.value)} {reference.unit} sur {PERIOD_LABELS[reference.period]}
          </Text>
        ) : null}
        {showSource ? <Text style={styles.reference}>Source : {MEASURE_SOURCE_LABELS[measure.source]}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: SPACING.md, gap: SPACING.sm },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.md },
  names: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  formula: { ...TYPE.bodySemibold, color: COLORS.text },
  name: { ...TYPE.small, color: COLORS.textMuted, flexShrink: 1 },
  value: { ...TYPE.valueSmall, color: COLORS.text },
  unit: { ...TYPE.caption, color: COLORS.textMuted },
  bar: { height: 4, borderRadius: 2, backgroundColor: COLORS.track, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  marker: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: COLORS.textMuted },
  bottom: { gap: SPACING.xxs },
  status: { ...TYPE.captionMedium },
  reference: { ...TYPE.caption, color: COLORS.textMuted },
});
