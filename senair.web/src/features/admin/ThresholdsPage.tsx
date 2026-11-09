import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDateTime, formatMeasure, getPollutant, REFERENCE_LABELS, toUserMessage, type Threshold, type ThresholdInput } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { DataTable } from '../../shared/ui/DataTable';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { serverFieldErrors } from '../../shared/lib/forms';
import { PERIOD_LABELS } from '../../shared/lib/labels';
import { useZones } from '../air-quality/hooks';
import { ThresholdForm } from './components/ThresholdForm';
import { useAdminThresholds } from './hooks';

const INVALIDATE = [queryKeys.admin.thresholds, queryKeys.reference.thresholds];

export function ThresholdsPage() {
  const api = useApi();
  const query = useAdminThresholds();
  const zones = useZones();
  const [editing, setEditing] = useState<Threshold | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Threshold | null>(null);
  const zoneName = (zoneId: string | null) => (zoneId ? (zones.data?.find((z) => z.id === zoneId)?.name ?? zoneId) : 'Toute la ville');

  const save = useFeedbackMutation({
    mutationFn: (input: ThresholdInput) => (editing && editing !== 'new' ? api.admin.updateThreshold(editing.id, input) : api.admin.createThreshold(input)),
    invalidate: INVALIDATE,
    successMessage: 'Seuil enregistré.',
    onSuccess: () => setEditing(null),
    silentError: true,
  });
  const remove = useFeedbackMutation({
    mutationFn: (id: string) => api.admin.deleteThreshold(id),
    invalidate: INVALIDATE,
    successMessage: 'Seuil supprimé.',
    onSuccess: () => setDeleting(null),
  });
  const toggle = useFeedbackMutation({
    mutationFn: (t: Threshold) => api.admin.updateThreshold(t.id, { enabled: !t.enabled }),
    invalidate: INVALIDATE,
    successMessage: (t) => (t.enabled ? 'Seuil activé.' : 'Seuil désactivé.'),
  });
  const serverErrors = serverFieldErrors(save.error);

  return (
    <div className="stack">
      <PageHeader
        title="Seuils d'alerte"
        description="Valeurs limites par polluant, référentiel et zone. Un dépassement déclenche une alerte du niveau choisi."
        actions={
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => { save.reset(); setEditing('new'); }}>
            Nouveau seuil
          </Button>
        }
      />
      <QueryState query={query} isEmpty={(list) => list.length === 0} emptyMessage="Aucun seuil configuré.">
        {(thresholds) => (
          <DataTable
            caption="Seuils configurés"
            rows={thresholds}
            rowKey={(t) => t.id}
            columns={[
              { key: 'pollutant', header: 'Polluant', render: (t) => getPollutant(t.pollutant)?.formula ?? t.pollutant },
              { key: 'value', header: 'Valeur', render: (t) => `${formatMeasure(t.value)} ${t.unit}` },
              { key: 'period', header: 'Période', render: (t) => PERIOD_LABELS[t.period] },
              { key: 'reference', header: 'Référentiel', render: (t) => REFERENCE_LABELS[t.reference] },
              { key: 'zone', header: 'Zone', render: (t) => zoneName(t.zoneId) },
              { key: 'level', header: 'Alerte', render: (t) => <AqiBadge aqi={null} level={t.alertLevel} labelOnly size="sm" short /> },
              {
                key: 'enabled',
                header: 'Statut',
                render: (t) => (
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(t)} aria-label={`${t.enabled ? 'Désactiver' : 'Activer'} le seuil ${getPollutant(t.pollutant)?.formula}`}>
                    <Badge tone={t.enabled ? 'success' : 'neutral'}>{t.enabled ? 'Actif' : 'Inactif'}</Badge>
                  </Button>
                ),
              },
              { key: 'updated', header: 'Modifié', render: (t) => <span className="small">{formatDateTime(t.updatedAt)}{t.updatedBy ? ` · ${t.updatedBy}` : ''}</span> },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                render: (t) => (
                  <div className="row">
                    <Button size="sm" variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => { save.reset(); setEditing(t); }} aria-label="Modifier le seuil" />
                    <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDeleting(t)} aria-label="Supprimer le seuil" />
                  </div>
                ),
              },
            ]}
          />
        )}
      </QueryState>

      <Modal open={editing !== null} title={editing === 'new' ? 'Nouveau seuil' : 'Modifier le seuil'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <>
            {save.isError && Object.keys(serverErrors).length === 0 && <p className="form-error" role="alert">{toUserMessage(save.error)}</p>}
            <ThresholdForm
              key={editing === 'new' ? 'new' : editing.id}
              threshold={editing === 'new' ? null : editing}
              pending={save.isPending}
              serverErrors={serverErrors}
              onSubmit={(input) => save.mutate(input)}
              onCancel={() => setEditing(null)}
            />
          </>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Supprimer ce seuil ?"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              Supprimer
            </Button>
          </>
        }
      >
        {deleting && (
          <p>
            Le seuil {getPollutant(deleting.pollutant)?.formula} à {formatMeasure(deleting.value)} {deleting.unit} ({zoneName(deleting.zoneId)}) ne déclenchera plus
            d'alerte. Cette action est tracée dans le journal d'audit.
          </p>
        )}
      </Modal>
    </div>
  );
}
