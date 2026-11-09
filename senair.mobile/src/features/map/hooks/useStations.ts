import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

/** Stations avec leur dernière mesure. Pas de valeur de repli : une station sans mesure reste « N/D ». */
export function useStations() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.stations.list(),
    queryFn: () => api.stations.list({ includeLatest: true }),
    refetchInterval: 5 * 60_000,
  });
}

export function useStation(stationId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.stations.detail(stationId),
    queryFn: () => api.stations.get(stationId),
    enabled: stationId.length > 0,
    refetchInterval: 5 * 60_000,
  });
}
