import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Alert, AlertQuery, AqiLevel, Page } from '@senair/core';
import { useApi, useSession } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

export interface AlertFilters {
  severities: AqiLevel[];
}

const PAGE_SIZE = 20;

/**
 * Alertes paginées (curseur). Connecté : mes alertes (zones et niveau suivis), avec l'état lu,
 * sans celles que j'ai supprimées. Sans compte : l'historique public.
 */
export function useAlertHistory(filters: AlertFilters) {
  const api = useApi();
  const personal = useSession().status === 'authenticated';
  const query: AlertQuery = { severity: filters.severities, limit: PAGE_SIZE };
  const result = useInfiniteQuery({
    queryKey: personal ? queryKeys.account.myAlerts(query) : queryKeys.alerts.list(query),
    queryFn: ({ pageParam }) => {
      const page = { ...query, cursor: pageParam ?? undefined };
      return personal ? api.account.myAlerts(page) : api.alerts.list(page);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  return { ...result, personal };
}

/** Nombre d'alertes non lues (pastille de l'onglet Alertes) ; 0 sans compte. */
export function useUnreadAlertCount(): number {
  const api = useApi();
  const signedIn = useSession().status === 'authenticated';
  const unread = useQuery({
    queryKey: queryKeys.account.unreadAlerts(),
    queryFn: async () => (await api.account.myAlerts({ unread: true, limit: 1 })).total ?? 0,
    enabled: signedIn,
    refetchInterval: 5 * 60_000,
  });
  return signedIn ? (unread.data ?? 0) : 0;
}

type AlertPages = InfiniteData<Page<Alert>, string | null>;

/** Mutation sur mes alertes : la liste change tout de suite (optimiste), puis se resynchronise avec le serveur. */
function useAlertMutation<T>(run: (arg: T) => Promise<void>, change: (arg: T) => (alert: Alert) => Alert | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: (arg: T) =>
      client.setQueriesData<AlertPages>({ queryKey: queryKeys.account.myAlertsAll() }, (data) =>
        data?.pages ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.flatMap((alert) => change(arg)(alert) ?? []) })) } : data,
      ),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.account.myAlertsAll() }),
  });
}

/** Lire, supprimer, tout marquer comme lu. */
export function useAlertActions() {
  const api = useApi();
  const markRead = useAlertMutation(
    (id: string) => api.account.markAlertRead(id),
    (id) => (alert) => (alert.id === id ? { ...alert, read: true } : alert),
  );
  const dismiss = useAlertMutation(
    (id: string) => api.account.dismissAlert(id),
    (id) => (alert) => (alert.id === id ? null : alert),
  );
  const readAll = useAlertMutation(
    () => api.account.markAllAlertsRead(),
    () => (alert) => ({ ...alert, read: true }),
  );
  return { markRead, dismiss, readAll };
}

/** Alerte en cours la plus récente (« alerte du jour » de l'accueil). */
export function useActiveAlert() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.alerts.active(),
    queryFn: async () => (await api.alerts.list({ status: ['active'], limit: 1 })).items[0] ?? null,
    refetchInterval: 5 * 60_000,
  });
}
