import { useQuery } from '@tanstack/react-query';
import type { Station } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { historyWindow, type HistoryRange } from '../../shared/lib/time';

const LIVE_REFRESH_MS = 5 * 60_000;

export function useAirQualitySummary(zoneId: string | null = null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.airQuality.summary(zoneId),
    queryFn: () => api.airQuality.summary(zoneId ? { zoneId } : {}),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useZones() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reference.zones,
    queryFn: () => api.reference.zones(),
    staleTime: 60 * 60_000,
  });
}

export function useStations(query: { zoneId?: string; type?: Station['type']; includeLatest?: boolean } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.stations.list(query),
    queryFn: () => api.stations.list(query),
    refetchInterval: query.includeLatest ? LIVE_REFRESH_MS : false,
  });
}

export function useStation(stationId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.stations.detail(stationId),
    queryFn: () => api.stations.get(stationId),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useStationHistory(stationId: string, range: HistoryRange) {
  const api = useApi();
  const query = historyWindow(range);
  return useQuery({
    queryKey: queryKeys.stations.history(stationId, query),
    queryFn: () => api.stations.history(stationId, query),
  });
}

export function useZoneHistory(zoneId: string | null, range: HistoryRange) {
  const api = useApi();
  const query = historyWindow(range);
  return useQuery({
    queryKey: queryKeys.airQuality.zoneHistory(zoneId ?? '', query),
    queryFn: () => api.airQuality.zoneHistory(zoneId ?? '', query),
    enabled: zoneId !== null,
  });
}

export function useCityHistory(range: HistoryRange) {
  const api = useApi();
  const query = historyWindow(range);
  return useQuery({
    queryKey: queryKeys.airQuality.cityHistory(query),
    queryFn: () => api.airQuality.cityHistory(query),
  });
}

export function useActiveAlerts(zoneId?: string) {
  const api = useApi();
  const query = { status: ['active' as const], zoneId, limit: 5 };
  return useQuery({
    queryKey: queryKeys.alerts.list(query),
    queryFn: () => api.alerts.list(query),
    refetchInterval: LIVE_REFRESH_MS,
  });
}
