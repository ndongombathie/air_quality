import type { ReactNode } from 'react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Alert, Page } from '@senair/core';
import { AlertCard } from '../../shared/ui/AlertCard';
import { Button } from '../../shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/QueryState';

interface AlertListProps {
  query: UseInfiniteQueryResult<InfiniteData<Page<Alert>>>;
  emptyMessage?: string;
  renderActions?: (alert: Alert) => ReactNode;
  renderExtra?: (alert: Alert) => ReactNode;
}

/** Liste paginée d'alertes (chargement / erreur / vide / « charger plus »). */
export function AlertList({ query, emptyMessage = 'Aucune alerte ne correspond à ces critères.', renderActions, renderExtra }: AlertListProps) {
  if (query.isPending) return <LoadingState label="Chargement des alertes…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const alerts = query.data.pages.flatMap((page) => page.items);
  if (alerts.length === 0) return <EmptyState message={emptyMessage} />;
  const total = query.data.pages[0]?.total;
  return (
    <div className="stack stack--sm">
      {total != null && <p className="muted small" role="status">{total} alerte{total > 1 ? 's' : ''}</p>}
      <ul className="stack stack--sm" aria-label="Alertes">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <AlertCard alert={alert} actions={renderActions?.(alert)} extra={renderExtra?.(alert)} />
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          Charger plus
        </Button>
      )}
    </div>
  );
}
