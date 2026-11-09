import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { toUserMessage } from '@senair/core';
import { Button } from './Button';
import { SkeletonGroup } from './Skeleton';

/** Chargement en squelette ; le libellé n'est lu que par les lecteurs d'écran. */
export function LoadingState({ label = 'Chargement', block = false, lines = 3 }: { label?: string; block?: boolean; lines?: number }) {
  return <SkeletonGroup label={label} block={block} lines={lines} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <p>{toUserMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RefreshCw size={16} aria-hidden="true" />} onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <Inbox size={22} aria-hidden="true" />
      <p>{message}</p>
      {children}
    </div>
  );
}

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  loadingLabel?: string;
  /** Forme du squelette : un grand bloc (graphe, héros) ou des lignes. */
  skeletonBlock?: boolean;
}

/** Rend explicitement les états chargement / erreur (avec réessai) / vide d'une requête. */
export function QueryState<T>({ query, children, isEmpty, emptyMessage = 'Aucune donnée disponible.', loadingLabel, skeletonBlock }: QueryStateProps<T>) {
  if (query.isPending) return <LoadingState label={loadingLabel} block={skeletonBlock} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data)) return <EmptyState message={emptyMessage} />;
  return <>{children(query.data)}</>;
}
