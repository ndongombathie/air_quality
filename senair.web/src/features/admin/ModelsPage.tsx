import { useState } from 'react';
import { formatDateTime, formatMeasure, type AiModel } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { DataTable } from '../../shared/ui/DataTable';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { MODEL_STATUS_LABELS, MODEL_TASK_LABELS, safeExternalUrl } from '../../shared/lib/labels';
import { useModels } from './hooks';

const STATUS_TONE = { active: 'success', candidate: 'info', archived: 'neutral' } as const;

export function ModelsPage() {
  const api = useApi();
  const query = useModels();
  const [activating, setActivating] = useState<AiModel | null>(null);
  const update = useFeedbackMutation({
    mutationFn: ({ model, status }: { model: AiModel; status: AiModel['status'] }) => api.admin.updateModel(model.id, { status }),
    invalidate: [queryKeys.admin.models, queryKeys.reference.metadata, ['forecasts']],
    successMessage: (model) => `${model.name} v${model.version} : ${MODEL_STATUS_LABELS[model.status].toLowerCase()}.`,
    onSuccess: () => setActivating(null),
  });

  return (
    <div className="stack">
      <PageHeader title="Modèles IA" description="Modèles de prévision, d'interpolation et de classification. Activer un candidat remplace le modèle actif de la même tâche." />
      <QueryState query={query} isEmpty={(list) => list.length === 0} emptyMessage="Aucun modèle enregistré.">
        {(models) => (
          <DataTable
            caption="Modèles"
            rows={models}
            rowKey={(m) => m.id}
            columns={[
              {
                key: 'name',
                header: 'Modèle',
                render: (m) => {
                  const url = safeExternalUrl(m.trackingUrl);
                  return (
                    <>
                      <span className="strong">{m.name}</span>
                      <br />
                      <span className="small muted">
                        {m.algorithm} · v{m.version}
                        {url && (
                          <>
                            {' '}
                            ·{' '}
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              Suivi MLflow
                            </a>
                          </>
                        )}
                      </span>
                    </>
                  );
                },
              },
              { key: 'task', header: 'Tâche', render: (m) => MODEL_TASK_LABELS[m.task] },
              { key: 'status', header: 'Statut', render: (m) => <Badge tone={STATUS_TONE[m.status]}>{MODEL_STATUS_LABELS[m.status]}</Badge> },
              { key: 'r2', header: 'R²', render: (m) => formatMeasure(m.metrics.r2, 2) },
              { key: 'rmse', header: 'RMSE', render: (m) => formatMeasure(m.metrics.rmse, 2) },
              { key: 'mae', header: 'MAE', render: (m) => formatMeasure(m.metrics.mae, 2) },
              { key: 'trained', header: 'Entraîné', render: (m) => formatDateTime(m.trainedAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                render: (m) => (
                  <div className="row">
                    {m.status === 'candidate' && (
                      <Button size="sm" onClick={() => setActivating(m)}>
                        Activer
                      </Button>
                    )}
                    {m.status !== 'archived' && m.status !== 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ model: m, status: 'archived' })}>
                        Archiver
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      <Modal
        open={activating !== null}
        title="Activer ce modèle ?"
        onClose={() => setActivating(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActivating(null)}>
              Annuler
            </Button>
            <Button loading={update.isPending} onClick={() => activating && update.mutate({ model: activating, status: 'active' })}>
              Activer
            </Button>
          </>
        }
      >
        {activating && (
          <p>
            {activating.name} v{activating.version} ({activating.algorithm}) sera utilisé pour les prévisions publiques. R² {formatMeasure(activating.metrics.r2, 2)}, RMSE{' '}
            {formatMeasure(activating.metrics.rmse, 2)}, MAE {formatMeasure(activating.metrics.mae, 2)}.
          </p>
        )}
      </Modal>
    </div>
  );
}
