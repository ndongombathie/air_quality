import { StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import { FORECAST_HORIZON_LABELS, TREND_LABELS, formatPercent, isShortTermHorizon, type Forecast } from '@senair/core';
import { LevelChip, LevelDot } from '@/shared/ui';
import { formatAqi, formatRange } from '@/shared/format/display';
import { COLORS, SPACING, TYPE } from '@/theme';

const TREND_ICONS = { up: ArrowUpRight, down: ArrowDownRight, stable: ArrowRight } as const;

function when(forecast: Forecast): string {
  const date = new Date(forecast.validAt);
  if (Number.isNaN(date.getTime())) return '';
  return isShortTermHorizon(forecast.horizon)
    ? `${date.getHours().toString().padStart(2, '0')} h`
    : date.toLocaleDateString('fr-FR', { weekday: 'long' });
}

/** Ligne compacte : horizon, IQA et point de couleur, puce, tendance, barre de confiance. */
export function ForecastRow({ forecast }: { forecast: Forecast }) {
  const horizon = FORECAST_HORIZON_LABELS[forecast.horizon];
  const TrendIcon = TREND_ICONS[forecast.trend];
  const confidence = forecast.confidence;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${horizon.long} : IQA ${formatAqi(forecast.aqi)}, ${TREND_LABELS[forecast.trend]}, intervalle ${formatRange(forecast.interval?.low, forecast.interval?.high)}, confiance ${formatPercent(confidence)}`}
    >
      <View style={styles.when}>
        <Text style={styles.horizon}>{horizon.short}</Text>
        <Text style={styles.time} numberOfLines={1}>
          {when(forecast)}
        </Text>
      </View>
      <View style={styles.value}>
        <LevelDot level={forecast.level} />
        <Text style={styles.aqi}>{formatAqi(forecast.aqi)}</Text>
      </View>
      <View style={styles.middle}>
        <LevelChip level={forecast.level} short />
        <View style={styles.trend}>
          <TrendIcon size={13} color={COLORS.textMuted} />
          <Text style={styles.caption}>{TREND_LABELS[forecast.trend]}</Text>
        </View>
      </View>
      <View style={styles.confidence}>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${Math.round((confidence ?? 0) * 100)}%` }]} />
        </View>
        <Text style={styles.caption}>{formatPercent(confidence)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  when: { width: 64 },
  horizon: { ...TYPE.smallSemibold, color: COLORS.text },
  time: { ...TYPE.caption, color: COLORS.textMuted },
  value: { width: 52, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + SPACING.xxs },
  aqi: { ...TYPE.valueSmall, color: COLORS.text },
  middle: { flex: 1, gap: SPACING.xs },
  trend: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxs },
  confidence: { width: 52, alignItems: 'flex-end', gap: SPACING.xs },
  bar: { width: 52, height: 4, borderRadius: 2, backgroundColor: COLORS.track, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  caption: { ...TYPE.caption, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
});
