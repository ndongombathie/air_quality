import { useRef, useState, type ComponentRef } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Card, DataStatusBanner, SectionHeader, SkyBackdrop, StateView } from '@/shared/ui';
import { useZones } from '@/shared/hooks/useZones';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useMotion } from '@/shared/motion/useMotion';
import { formatDelta } from '@/shared/format/display';
import type { HistoryScope } from '@/shared/api/queryKeys';
import { TodayAlertBanner } from '@/features/alerts/components/TodayAlertBanner';
import { ForecastCarousel } from '@/features/forecasts/components/ForecastCarousel';
import { COLORS, CONTENT_MAX_WIDTH, SPACING, TYPE } from '@/theme';
import { CurrentAirCard } from '../components/CurrentAirCard';
import { HistorySection } from '../components/HistorySection';
import { LocationPrompt } from '../components/LocationPrompt';
import { PollutantList } from '../components/PollutantList';
import { QUICK_ACTION_ICONS, QuickActions } from '../components/QuickActions';
import { WeatherCard } from '../components/WeatherCard';
import { ZoneCarousel } from '../components/ZoneCarousel';
import { CITY_SCOPE, ZonePicker } from '../components/ZonePicker';
import { useAirQualitySummary, useLocationAirQuality } from '../hooks/useAirQuality';
import { useUserLocation } from '../hooks/useUserLocation';
import { selectCurrentAir } from '../hooks/selectCurrentAir';

export function HomeScreen() {
  const { isTablet } = useResponsive();
  const motion = useMotion();
  const location = useUserLocation();
  const summary = useAirQualitySummary();
  const local = useLocationAirQuality(location.point);
  const zones = useZones();
  const [historyScopeId, setHistoryScopeId] = useState<string>(CITY_SCOPE);
  const { refreshing, onRefresh } = useRefresh(summary.refetch, location.point && local.refetch, zones.refetch);

  const scrollRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  // Position du bloc prévisions = haut du conteneur + décalage dans celui-ci (pour l'action rapide).
  const blockY = useRef(0);
  const forecastY = useRef(0);

  const current = selectCurrentAir(summary.data, local.data);
  const localZone = local.data?.zoneId ?? null;
  const historyScope: HistoryScope = historyScopeId === CITY_SCOPE ? { kind: 'city' } : { kind: 'zone', id: historyScopeId };
  const historyName = historyScopeId === CITY_SCOPE ? 'toute la ville' : (zones.data?.find((z) => z.id === historyScopeId)?.name ?? '');
  const forecastQuery = localZone ? { scope: 'zone' as const, scopeId: localZone } : { scope: 'city' as const };

  const actions = [
    { key: 'map', label: 'Carte', Icon: QUICK_ACTION_ICONS.map, onPress: () => router.push('/map') },
    {
      key: 'forecasts',
      label: 'Prévisions',
      Icon: QUICK_ACTION_ICONS.forecasts,
      onPress: () => scrollRef.current?.scrollTo({ y: Math.max(blockY.current + forecastY.current - 16, 0), animated: !motion.reduced }),
    },
    { key: 'health', label: 'Conseils santé', Icon: QUICK_ACTION_ICONS.health, onPress: () => router.push('/health') },
    { key: 'alerts', label: 'Alertes', Icon: QUICK_ACTION_ICONS.alerts, onPress: () => router.push('/alerts') },
  ];

  const comparison =
    summary.data && !local.data ? (
      <Text style={styles.comparison}>
        Par rapport à hier : {formatDelta(summary.data.comparison.vsYesterday)} points, à la semaine dernière :{' '}
        {formatDelta(summary.data.comparison.vsLastWeek)} points
      </Text>
    ) : null;

  const hero = current ? (
    <CurrentAirCard
      title={current.title}
      subtitle={current.subtitle}
      aqi={current.source.aqi}
      level={current.source.level}
      dominantPollutant={current.source.dominantPollutant}
      observedAt={current.source.observedAt}
      freshness={current.source.freshness}
      status={current.source.status}
      footer={comparison}
    />
  ) : summary.isError ? (
    <Card>
      <StateView kind="error" error={summary.error} onRetry={() => void summary.refetch()} />
    </Card>
  ) : (
    <StateView kind="loading" graphic lines={3} />
  );

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={COLORS.primaryText} colors={[COLORS.primaryText]} />}
      >
        <SkyBackdrop height={320} />
        <View style={styles.inner}>
          <DataStatusBanner refreshError={summary.isRefetchError ? summary.error : null} />
          <View style={styles.stack}>
            <TodayAlertBanner />
            <LocationPrompt state={location.state} onLocate={() => void location.locate()} onUseCity={location.reset} />
          </View>

          <View style={isTablet ? styles.columns : undefined} onLayout={(e) => (blockY.current = e.nativeEvent.layout.y)}>
            <Animated.View entering={motion.enter(0)} style={[styles.hero, isTablet && styles.column]}>
              {hero}
              {local.isError ? (
                <Card style={styles.spaced}>
                  <StateView kind="error" error={local.error} onRetry={() => void local.refetch()} />
                </Card>
              ) : null}
            </Animated.View>
            <View style={isTablet ? styles.column : undefined}>
              <Animated.View entering={motion.enter(1)} style={styles.spaced}>
                <QuickActions actions={actions} />
              </Animated.View>
              <View onLayout={(e) => (forecastY.current = e.nativeEvent.layout.y)}>
                <SectionHeader title="Prévisions" subtitle={localZone ? `Zone ${local.data?.zoneName ?? ''}` : 'Thiès, prochaines heures et 3 jours'} />
                <ForecastCarousel query={forecastQuery} />
              </View>
            </View>
          </View>

          <SectionHeader title="Quartiers à surveiller" subtitle="Les plus exposés en ce moment" actionText="Carte" onAction={() => router.push('/map')} />
          {summary.data ? <ZoneCarousel zones={summary.data.worstZones} onOpen={() => router.push('/map')} /> : <StateView kind="loading" lines={2} />}

          <SectionHeader title="Météo" subtitle="Le vent et l'humidité influencent la dispersion" />
          <WeatherCard weather={current?.source.weather ?? null} />

          {current && current.source.measures.length > 0 ? (
            <>
              <SectionHeader title="Polluants mesurés" subtitle="Comparés aux valeurs guides OMS 2021" />
              <PollutantList measures={current.source.measures} />
            </>
          ) : null}

          <HistorySection
            scope={historyScope}
            scopeName={historyName}
            scopePicker={zones.data ? <ZonePicker zones={zones.data} selected={historyScopeId} onSelect={setHistoryScopeId} /> : null}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: SPACING.xxxl },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: SPACING.lg },
  stack: { gap: SPACING.md, marginTop: SPACING.md },
  hero: { marginTop: SPACING.lg },
  spaced: { marginTop: SPACING.lg },
  columns: { flexDirection: 'row', gap: SPACING.xl },
  column: { flex: 1 },
  comparison: { ...TYPE.caption, color: COLORS.textMuted },
});
