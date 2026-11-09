import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AlertQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useNotificationPreferences() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.account.preferences, queryFn: () => api.account.notificationPreferences() });
}

export function useMyAlerts(query: AlertQuery) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.account.alerts(query),
    queryFn: ({ pageParam }) => api.account.myAlerts({ ...query, cursor: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
