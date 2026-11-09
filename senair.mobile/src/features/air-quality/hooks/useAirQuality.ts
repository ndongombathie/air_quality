import { skipToken, useQuery } from '@tanstack/react-query';
import type { GeoPoint } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

/** Synthèse ville (ou zone) : IQA, polluant dominant, météo, classement des zones. */
export function useAirQualitySummary(zoneId: string | null = null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.airQuality.summary(zoneId),
    queryFn: () => api.airQuality.summary(zoneId ? { zoneId } : {}),
    refetchInterval: 5 * 60_000,
  });
}

/** IQA estimé par le backend à une position (jamais interpolé côté client). */
export function useLocationAirQuality(point: GeoPoint | null) {
  const api = useApi();
  return useQuery({
    queryKey: point ? queryKeys.airQuality.atLocation(point) : ['airQuality', 'atLocation', 'none'],
    queryFn: point ? () => api.airQuality.atLocation(point) : skipToken,
    refetchInterval: 5 * 60_000,
  });
}

export function useThresholds() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reference.thresholds(),
    queryFn: () => api.reference.thresholds(),
    staleTime: 60 * 60_000,
  });
}
