import { Fragment, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MEASURE_SOURCE_LABELS, REFERENCE_THRESHOLDS, getPollutant, type Measure, type MeasureCode } from '@senair/core';
import { Card, StateView } from '@/shared/ui';
import { measureText } from '@/shared/format/display';
import { COLORS, SPACING, TYPE } from '@/theme';
import { useThresholds } from '../hooks/useAirQuality';
import { PollutantRow, type PollutantReference } from './PollutantCard';

/**
 * Polluants de l'IQA. Seuils : ceux de l'API (`reference.thresholds`, OMS 2021),
 * repli sur le référentiel publié de core si l'API ne répond pas.
 */
export function PollutantList({ measures, showSource = false }: { measures: Measure[]; showSource?: boolean }) {
  const thresholds = useThresholds();

  const references = useMemo(() => {
    const source = thresholds.data?.filter((t) => t.zoneId === null) ?? REFERENCE_THRESHOLDS;
    const map = new Map<MeasureCode, PollutantReference>();
    for (const t of source) {
      if (t.reference !== 'WHO_2021' || t.period === '1y' || map.has(t.pollutant)) continue;
      map.set(t.pollutant, { value: t.value, unit: t.unit, reference: t.reference, period: t.period });
    }
    return map;
  }, [thresholds.data]);

  const shown = measures.filter((m) => getPollutant(m.code)?.inAqi);
  if (shown.length === 0) return <StateView kind="empty" message="Aucune mesure de polluant disponible." />;

  return (
    <Card style={styles.card}>
      {shown.map((measure, i) => (
        <Fragment key={measure.code}>
          {i > 0 ? <View style={styles.separator} /> : null}
          <PollutantRow measure={measure} reference={references.get(measure.code) ?? null} showSource={showSource} />
        </Fragment>
      ))}
    </Card>
  );
}

/** Grandeurs complémentaires hors IQA (CO₂, COV, NO, NH₃) avec leur provenance. */
export function OtherMeasures({ measures }: { measures: Measure[] }) {
  const others = measures.filter((m) => getPollutant(m.code)?.inAqi === false);
  if (others.length === 0) return null;
  return (
    <Card style={styles.card}>
      {others.map((m, i) => {
        const info = getPollutant(m.code);
        return (
          <View key={m.code} style={[styles.other, i > 0 && styles.otherBorder]} accessible accessibilityLabel={`${info?.name ?? m.code} : ${measureText(m)}, source ${MEASURE_SOURCE_LABELS[m.source]}`}>
            <View style={styles.otherNames}>
              <Text style={styles.formula}>{info?.formula ?? m.code}</Text>
              <Text style={styles.caption}>{MEASURE_SOURCE_LABELS[m.source]}</Text>
            </View>
            <Text style={styles.value}>{measureText(m)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: SPACING.xs },
  separator: { height: 1, backgroundColor: COLORS.border },
  other: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.md },
  otherBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  otherNames: { flex: 1, gap: SPACING.xxs },
  formula: { ...TYPE.bodySemibold, color: COLORS.text },
  caption: { ...TYPE.caption, color: COLORS.textMuted },
  value: { ...TYPE.valueSmall, color: COLORS.text },
});
