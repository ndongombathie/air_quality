import { formatPercent, formatRelativeTime, type DataSource } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { DATA_SOURCE_KIND_LABELS, DATA_SOURCE_STATUS_LABELS } from '../../shared/lib/labels';
import { useDataSources } from './hooks';

const STATUS_TONE = { healthy: 'success', degraded: 'warning', down: 'danger', disabled: 'neutral' } as const;

export function DataSourcesPage() {
  const api = useApi();
  const query = useDataSources();
  const toggle = useFeedbackMutation({
    mutationFn: (source: DataSource) => api.admin.updateDataSource(source.id, { enabled: !source.enabled }),
    invalidate: [queryKeys.admin.dataSources, queryKeys.admin.dashboard],
    successMessage: (source) => `${source.name} : ${source.enabled ? 'activée' : 'désactivée'}.`,
  });

  return (
    <div className="stack">
      <PageHeader title="Sources de données" description="Capteurs, API météo, satellite et jeux historiques alimentant la plateforme." />
      <QueryState query={query} isEmpty={(list) => list.length === 0} emptyMessage="Aucune source configurée.">
        {(sources) => (
          <div className="grid grid--2">
            {sources.map((source) => (
              <article key={source.id} className="card">
                <header className="card__header">
                  <h2 className="card__title">{source.name}</h2>
                  <Badge tone={STATUS_TONE[source.status]}>{DATA_SOURCE_STATUS_LABELS[source.status]}</Badge>
                </header>
                <p className="muted">{source.description}</p>
                <dl className="facts">
                  <div>
                    <dt>Type</dt>
                    <dd>{DATA_SOURCE_KIND_LABELS[source.kind]}</dd>
                  </div>
                  <div>
                    <dt>Dernière synchronisation</dt>
                    <dd>{formatRelativeTime(source.lastSyncAt)}</dd>
                  </div>
                  <div>
                    <dt>Rejets (24 h)</dt>
                    <dd>{formatPercent(source.rejectionRate24h)}</dd>
                  </div>
                </dl>
                <Button
                  variant={source.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  loading={toggle.isPending && toggle.variables?.id === source.id}
                  onClick={() => toggle.mutate(source)}
                >
                  {source.enabled ? 'Désactiver' : 'Activer'}
                </Button>
              </article>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
