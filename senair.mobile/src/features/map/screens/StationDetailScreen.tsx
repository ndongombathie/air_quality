import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '@senair/core';
import { DataStatusBanner, Screen, SectionHeader, StateView } from '@/shared/ui';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { CurrentAirCard } from '@/features/air-quality/components/CurrentAirCard';
import { HistorySection } from '@/features/air-quality/components/HistorySection';
import { OtherMeasures, PollutantList } from '@/features/air-quality/components/PollutantList';
import { WeatherCard } from '@/features/air-quality/components/WeatherCard';
import { ForecastPanel } from '@/features/forecasts/components/ForecastPanel';
import { COLORS, SPACING, TYPE } from '@/theme';
import { useStation } from '../hooks/useStations';

export function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = typeof id === 'string' ? id : '';
  const station = useStation(stationId);
  const { refreshing, onRefresh } = useRefresh(station.refetch);

  if (!station.data) {
    return (
      <Screen topInset={false}>
        <View style={styles.pending}>
          {station.isError ? (
            <StateView kind="error" error={station.error} onRetry={() => void station.refetch()} />
          ) : (
            <StateView kind="loading" graphic lines={3} />
          )}
        </View>
      </Screen>
    );
  }

  const s = station.data;
  const latest = s.latest ?? null;

  return (
    <Screen topInset={false} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: s.shortName }} />
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {s.zoneName}, {STATION_TYPE_LABELS[s.type].toLowerCase()}, {STATION_STATUS_LABELS[s.status].toLowerCase()}, réseau {s.provider}
        </Text>
        <DataStatusBanner status={latest?.status} freshness={latest?.freshness} observedAt={latest?.observedAt} refreshError={station.isRefetchError ? station.error : null} />
      </View>
      {latest ? (
        <CurrentAirCard
          title={s.name}
          subtitle="Dernière mesure de la station"
          aqi={latest.aqi}
          level={latest.level}
          dominantPollutant={latest.dominantPollutant}
          observedAt={latest.observedAt}
          freshness={latest.freshness}
          status={latest.status}
        />
      ) : (
        <StateView kind="empty" message="Aucune mesure récente pour cette station." />
      )}
      <SectionHeader title="Prévisions" subtitle="Pour cette station" />
      <ForecastPanel query={{ scope: 'station', scopeId: s.id }} />
      {latest ? (
        <>
          <SectionHeader title="Polluants" subtitle="Comparés aux valeurs guides OMS 2021, avec leur source" />
          <PollutantList measures={latest.measures} showSource />
          <SectionHeader title="Autres mesures" subtitle="Hors calcul de l'IQA" />
          <OtherMeasures measures={latest.measures} />
          <SectionHeader title="Météo" />
          <WeatherCard weather={latest.weather} />
        </>
      ) : null}
      <HistorySection scope={{ kind: 'station', id: s.id }} scopeName={s.shortName} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { paddingTop: SPACING.lg },
  meta: { gap: SPACING.sm, paddingVertical: SPACING.lg },
  metaText: { ...TYPE.small, color: COLORS.textSecondary },
});
