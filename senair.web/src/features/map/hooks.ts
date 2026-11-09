import { useQuery } from '@tanstack/react-query';
import type { GeoPoint, HeatmapQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useHeatmap(layer: HeatmapQuery['layer'], enabled: boolean) {
  const api = useApi();
  const query: HeatmapQuery = { layer };
  return useQuery({
    queryKey: queryKeys.airQuality.heatmap(query),
    queryFn: () => api.airQuality.heatmap(query),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useAirQualityAt(point: GeoPoint | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.airQuality.atLocation(point ?? { latitude: 0, longitude: 0 }),
    queryFn: () => api.airQuality.atLocation(point as GeoPoint),
    enabled: point !== null,
  });
}
