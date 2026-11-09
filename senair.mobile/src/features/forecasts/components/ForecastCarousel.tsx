import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import { FORECAST_HORIZON_LABELS, TREND_LABELS, formatDateTime, formatPercent, isShortTermHorizon, type Forecast, type ForecastQuery } from '@senair/core';
import { Card, LevelChip, LevelDot, SkeletonBlock, StateView } from '@/shared/ui';
import { useMotion } from '@/shared/motion/useMotion';
import { formatAqi, formatRange } from '@/shared/format/display';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';
import { useForecasts } from '../hooks/useForecasts';

const TREND_ICONS = { up: ArrowUpRight, down: ArrowDownRight, stable: ArrowRight } as const;
const CARD_WIDTH = 132;

function when(f: Forecast): string {
  const d = new Date(f.validAt);
  if (Number.isNaN(d.getTime())) return '';
  return isShortTermHorizon(f.horizon) ? `${d.getHours().toString().padStart(2, '0')} h` : d.toLocaleDateString('fr-FR', { weekday: 'short' });
}

function ForecastTile({ forecast }: { forecast: Forecast }) {
  const TrendIcon = TREND_ICONS[forecast.trend];
  const horizon = FORECAST_HORIZON_LABELS[forecast.horizon];
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${horizon.long} : IQA ${formatAqi(forecast.aqi)}, ${TREND_LABELS[forecast.trend]}, intervalle ${formatRange(forecast.interval?.low, forecast.interval?.high)}, confiance ${formatPercent(forecast.confidence)}`}
    >
      <View style={styles.top}>
        <Text style={styles.horizon}>{horizon.short}</Text>
        <Text style={styles.when}>{when(forecast)}</Text>
      </View>
      <View style={styles.valueRow}>
        <LevelDot level={forecast.level} size={12} />
        <Text style={styles.aqi}>{formatAqi(forecast.aqi)}</Text>
      </View>
      <LevelChip level={forecast.level} short />
      <View style={styles.trend}>
        <TrendIcon size={13} color={COLORS.textMuted} />
        <Text style={styles.small}>{TREND_LABELS[forecast.trend]}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${Math.round((forecast.confidence ?? 0) * 100)}%` }]} />
      </View>
      <Text style={styles.small}>Confiance {formatPercent(forecast.confidence)}</Text>
    </View>
  );
}

/** Prévisions 1h à J+3 en cartes compactes défilant horizontalement. */
export function ForecastCarousel({ query }: { query: ForecastQuery }) {
  const motion = useMotion();
  const forecasts = useForecasts(query);
  const set = forecasts.data;
  if (!set) {
    if (forecasts.isError)
      return (
        <Card>
          <StateView kind="error" error={forecasts.error} onRetry={() => void forecasts.refetch()} />
        </Card>
      );
    return (
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.card, styles.skeleton]}>
            <SkeletonBlock width="50%" />
            <SkeletonBlock height={30} />
            <SkeletonBlock width="70%" />
          </View>
        ))}
      </View>
    );
  }
  if (set.forecasts.length === 0) return <StateView kind="empty" message="Aucune prévision disponible." />;
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} snapToInterval={CARD_WIDTH + SPACING.md} decelerationRate="fast">
        {set.forecasts.map((f, i) => (
          <Animated.View key={f.horizon} entering={motion.enter(i)}>
            <ForecastTile forecast={f} />
          </Animated.View>
        ))}
      </ScrollView>
      <Text style={styles.meta}>
        Modèle {set.modelName} {set.modelVersion}, généré le {formatDateTime(set.generatedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.xs, paddingRight: SPACING.lg },
  card: {
    width: CARD_WIDTH,
    padding: SPACING.md + SPACING.xxs,
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  skeleton: { height: 190 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  horizon: { ...TYPE.smallSemibold, color: COLORS.text },
  when: { ...TYPE.caption, color: COLORS.textMuted },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  aqi: { ...TYPE.h1, color: COLORS.text, fontVariant: ['tabular-nums'] },
  trend: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxs },
  bar: { height: 4, borderRadius: 2, backgroundColor: COLORS.track, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  small: { ...TYPE.caption, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  meta: { ...TYPE.caption, color: COLORS.textMuted },
});
