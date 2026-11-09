import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useMotion } from '@/shared/motion/useMotion';
import { router } from 'expo-router';
import { List, LocateFixed, Map as MapIcon } from 'lucide-react-native';
import { DataStatusBanner, PressableScale, ScreenTitle, SegmentedTabs, SkyBackdrop, StateView, tabIconColor } from '@/shared/ui';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { useUserLocation } from '@/features/air-quality/hooks/useUserLocation';
import { COLORS, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { AqiLegend } from '../components/AqiLegend';
import { LeafletMap, type LeafletMapHandle } from '../components/LeafletMap';
import { StationCard } from '../components/StationCard';
import { StationSheet } from '../components/StationSheet';
import { useStations } from '../hooks/useStations';
import { toStationMarkers } from '../mapModel';

type MapView = 'map' | 'list';

/** Deux onglets : la carte des stations, et la liste des stations. Sur tablette, les deux côte à côte. */
export function MapScreen() {
  const motion = useMotion();
  const { isTablet } = useResponsive();
  const [view, setView] = useState<MapView>('map');
  const stations = useStations();
  const location = useUserLocation();
  const mapRef = useRef<LeafletMapHandle>(null);
  const { refreshing, onRefresh } = useRefresh(stations.refetch);

  const markers = useMemo(() => toStationMarkers(stations.data ?? []), [stations.data]);
  const openStation = (id: string) => router.push({ pathname: '/station/[id]', params: { id } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stations.data?.find((s) => s.id === selectedId) ?? null;
  // Toucher un marqueur ouvre le panneau (pas de navigation immédiate) et centre la carte.
  const selectStation = useCallback(
    (id: string) => {
      setSelectedId(id);
      const station = stations.data?.find((s) => s.id === id);
      if (station) mapRef.current?.focus(station.location, 15);
    },
    [stations.data],
  );

  const locate = async () => {
    const result = await location.locate();
    if (result.status === 'granted') mapRef.current?.focus(result.point, 15);
  };

  const count = stations.data?.length;
  const showMap = isTablet || view === 'map';
  const showList = isTablet || view === 'list';

  const map = (
    <View style={[styles.mapPane, isTablet && styles.mapTablet]}>
      <View style={styles.mapWrap}>
        <LeafletMap ref={mapRef} stations={markers} heat={null} userPosition={location.point} onSelectStation={selectStation} />
        <PressableScale
          onPress={() => void locate()}
          accessibilityRole="button"
          accessibilityLabel="Ma position"
          accessibilityHint="Demande l'accès à votre position et centre la carte"
          style={styles.locate}
        >
          <LocateFixed size={20} color={COLORS.primaryText} strokeWidth={2} />
        </PressableScale>
      </View>
      <AqiLegend />
      {location.state.status === 'denied' || location.state.status === 'unavailable' ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {location.state.message}
        </Text>
      ) : null}
    </View>
  );

  const list = (
    <FlatList
      style={isTablet ? styles.side : undefined}
      data={stations.data ?? []}
      keyExtractor={(s) => s.id}
      renderItem={({ item, index }) => (
        <Animated.View entering={motion.enter(index % 8)}>
          <StationCard station={item} onPress={() => openStation(item.id)} />
        </Animated.View>
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <DataStatusBanner refreshError={stations.isRefetchError ? stations.error : null} />
          {isTablet ? (
            <Text style={styles.listTitle} accessibilityRole="header">
              {count ? `${count} stations` : 'Stations'}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        stations.isPending ? (
          <StateView kind="loading" lines={2} />
        ) : stations.isError ? (
          <StateView kind="error" error={stations.error} onRetry={() => void stations.refetch()} />
        ) : (
          <StateView kind="empty" message="Aucune station disponible." />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      contentContainerStyle={styles.listContent}
    />
  );

  return (
    <View style={styles.safe}>
      <SkyBackdrop height={200} />
      <View style={styles.top}>
        <ScreenTitle title="Carte" subtitle="Les stations de mesure de Thiès, en direct" />
        {isTablet ? null : (
          <SegmentedTabs
            value={view}
            onChange={setView}
            tabs={[
              {
                value: 'map',
                label: 'Carte',
                icon: (active) => <MapIcon size={16} color={tabIconColor(active)} />,
              },
              {
                value: 'list',
                label: count ? `Stations (${count})` : 'Stations',
                icon: (active) => <List size={16} color={tabIconColor(active)} />,
              },
            ]}
          />
        )}
      </View>
      <View style={[styles.body, isTablet && styles.row]}>
        {showMap ? map : null}
        {showList ? list : null}
      </View>
      {selected && showMap ? (
        <StationSheet key={selected.id} station={selected} bottomInset={0} onClose={() => setSelectedId(null)} onOpen={() => openStation(selected.id)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  top: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  body: { flex: 1 },
  row: { flexDirection: 'row' },
  mapPane: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  mapTablet: { flex: 3 },
  mapWrap: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  side: { flex: 2 },
  locate: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: TOUCH_TARGET + 4,
    height: TOUCH_TARGET + 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.raised,
  },
  header: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  warning: { ...TYPE.small, color: COLORS.textSecondary },
  listTitle: { ...TYPE.h2, color: COLORS.text },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
});
