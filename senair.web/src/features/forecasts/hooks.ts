import { useQuery } from '@tanstack/react-query';
import type { ForecastQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useForecasts(query: ForecastQuery) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.forecasts.get(query),
    queryFn: () => api.forecasts.get(query),
    staleTime: 10 * 60_000,
  });
}
