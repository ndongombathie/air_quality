import { Fragment, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatDateTime, isShortTermHorizon, type Forecast, type ForecastQuery } from '@senair/core';
import { Card, DataStatusBanner, StateView, PressableScale } from '@/shared/ui';
import { COLORS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { useForecasts } from '../hooks/useForecasts';
import { ForecastCurve } from './ForecastCurve';
import { ForecastRow } from './ForecastRow';

function RowGroup({ title, items }: { title: string; items: Forecast[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((f, i) => (
        <Fragment key={f.horizon}>
          {i > 0 ? <View style={styles.separator} /> : null}
          <ForecastRow forecast={f} />
        </Fragment>
      ))}
    </View>
  );
}

function Drivers({ drivers }: { drivers: string[] }) {
  const [open, setOpen] = useState(false);
  if (drivers.length === 0) return null;
  return (
    <View style={styles.drivers}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.driversToggle}
      >
        <Text style={styles.driversTitle}>Facteurs explicatifs</Text>
        {open ? <ChevronUp size={18} color={COLORS.primaryText} /> : <ChevronDown size={18} color={COLORS.primaryText} />}
      </PressableScale>
      {open
        ? drivers.map((d) => (
            <Text key={d} style={styles.driver}>
              {d}
            </Text>
          ))
        : null}
    </View>
  );
}

/** Prévisions 1h, 2h, 3h, J+1, J+2, J+3 : courbe avec bande de confiance, puis listes compactes. */
export function ForecastPanel({ query }: { query: ForecastQuery }) {
  const forecasts = useForecasts(query);
  const set = forecasts.data;
  if (!set) {
    return forecasts.isError ? (
      <Card>
        <StateView kind="error" error={forecasts.error} onRetry={() => void forecasts.refetch()} />
      </Card>
    ) : (
      <StateView kind="loading" graphic lines={3} />
    );
  }
  if (set.forecasts.length === 0) return <StateView kind="empty" message="Aucune prévision disponible." />;
  const drivers = [...new Set(set.forecasts.flatMap((f) => f.drivers))];

  return (
    <Card style={styles.card}>
      <ForecastCurve forecasts={set.forecasts} />
      <Text style={styles.legend}>Zone bleutée : intervalle de confiance du modèle</Text>
      <RowGroup title="Prochaines heures" items={set.forecasts.filter((f) => isShortTermHorizon(f.horizon))} />
      <RowGroup title="Prochains jours" items={set.forecasts.filter((f) => !isShortTermHorizon(f.horizon))} />
      <Drivers drivers={drivers} />
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Modèle {set.modelName} {set.modelVersion}, généré le {formatDateTime(set.generatedAt)}
        </Text>
        <DataStatusBanner status={set.status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm },
  legend: { ...TYPE.caption, color: COLORS.textMuted },
  group: { marginTop: SPACING.md },
  groupTitle: { ...TYPE.overline, color: COLORS.textMuted, marginBottom: SPACING.xxs },
  separator: { height: 1, backgroundColor: COLORS.border },
  drivers: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm },
  driversToggle: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driversTitle: { ...TYPE.smallSemibold, color: COLORS.primaryText },
  driver: { ...TYPE.small, color: COLORS.textSecondary, paddingBottom: SPACING.xs },
  meta: { gap: SPACING.sm, marginTop: SPACING.xs },
  metaText: { ...TYPE.caption, color: COLORS.textMuted },
});
