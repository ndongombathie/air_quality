import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AlertQuery, ArticleQuery, AuditQuery, UserQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useAdminDashboard() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.dashboard, queryFn: () => api.admin.dashboard(), refetchInterval: 60_000 });
}

export function useAdminStations() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.stations, queryFn: () => api.admin.stations() });
}

export function useAdminThresholds() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.thresholds, queryFn: () => api.admin.thresholds() });
}

export function useAdminAlerts(query: AlertQuery) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.alerts(query),
    queryFn: ({ pageParam }) => api.admin.alerts({ ...query, cursor: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: 60_000,
  });
}

export function useAdminArticles(query: ArticleQuery) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.articles(query), queryFn: () => api.admin.articles({ ...query, limit: 100 }) });
}

export function useAdminArticle(articleId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.admin.article(articleId ?? 'new'),
    queryFn: () => api.admin.article(articleId as string),
    enabled: articleId !== null,
  });
}

export function useDataSources() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.dataSources, queryFn: () => api.admin.dataSources() });
}

export function useModels() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.models, queryFn: () => api.admin.models() });
}

export function useReports() {
  const api = useApi();
  // Les liens de téléchargement expirent après 10 minutes : la liste est renouvelée avant.
  return useQuery({ queryKey: queryKeys.admin.reports, queryFn: () => api.admin.reports(), refetchInterval: 5 * 60_000, refetchIntervalInBackground: true });
}

export function useUsers(query: UserQuery) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.users(query), queryFn: () => api.admin.users({ ...query, limit: 100 }) });
}

export function useUsage(query: { from: string; to: string }) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.admin.usage(query), queryFn: () => api.admin.usage(query) });
}

export function useAuditLogs(query: AuditQuery) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.admin.audit(query),
    queryFn: ({ pageParam }) => api.admin.auditLogs({ ...query, cursor: pageParam ?? undefined, limit: 30 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
