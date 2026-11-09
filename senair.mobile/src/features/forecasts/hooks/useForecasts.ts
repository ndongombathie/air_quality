import { useQuery } from '@tanstack/react-query';
import type { ForecastQuery } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

/** Prévisions 1h/2h/3h/J+1/J+2/J+3 produites par le modèle backend. */
export function useForecasts(query: ForecastQuery) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.forecasts.get(query),
    queryFn: () => api.forecasts.get(query),
    refetchInterval: 15 * 60_000,
  });
}
