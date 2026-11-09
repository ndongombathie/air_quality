import { useInfiniteQuery } from '@tanstack/react-query';
import type { AlertQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function usePublicAlerts(query: AlertQuery) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.alerts.list(query),
    queryFn: ({ pageParam }) => api.alerts.list({ ...query, cursor: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
