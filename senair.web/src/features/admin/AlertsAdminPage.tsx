import { useState } from 'react';
import { CheckCircle2, Eye, Megaphone, Trash2 } from 'lucide-react';
import { formatRelativeTime, toUserMessage, type Alert, type AlertCreate, type AlertStatus, type AlertUpdate } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Button } from '../../shared/ui/Button';
import { TextAreaField } from '../../shared/ui/Field';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { serverFieldErrors } from '../../shared/lib/forms';
import { useAuth } from '../auth/AuthProvider';
import { AlertFilters, EMPTY_ALERT_FILTERS, toAlertQuery, type AlertFilterValue } from '../alerts/AlertFilters';
import { AlertList } from '../alerts/AlertList';
import { AlertForm } from './components/AlertForm';
import { useAdminAlerts } from './hooks';

const NOTE_MAX = 2000;
const INVALIDATE = [queryKeys.admin.alertsAll, queryKeys.alerts.all, queryKeys.admin.dashboard, queryKeys.account.all];
const ACTION_LABELS: Record<Exclude<AlertStatus, 'active'>, string> = {
  acknowledged: 'Prendre en charge',
  resolved: 'Résoudre',
};

function IncidentDialog({ target, onClose }: { target: { alert: Alert; status: Exclude<AlertStatus, 'active'> } | null; onClose: () => void }) {
  const api = useApi();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const mutation = useFeedbackMutation({
    mutationFn: ({ id, update }: { id: string; update: AlertUpdate }) => api.admin.updateAlert(id, update),
    invalidate: INVALIDATE,
    successMessage: (_data, { update }) => (update.status === 'resolved' ? 'Alerte résolue.' : 'Alerte prise en charge.'),
    onSuccess: () => {
      setNote('');
      onClose();
    },
  });

  const submit = () => {
    const trimmed = note.trim();
    if (target?.status === 'resolved' && trimmed.length < 5) return setError('Décrivez la résolution (5 caractères minimum).');
    if (trimmed.length > NOTE_MAX) return setError(`${NOTE_MAX} caractères maximum.`);
    setError(undefined);
    if (target) mutation.mutate({ id: target.alert.id, update: { status: target.status, ...(trimmed ? { incidentNote: trimmed } : {}) } });
  };

  return (
    <Modal
      open={target !== null}
      title={target ? `${ACTION_LABELS[target.status]} : ${target.alert.title}` : ''}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            Valider
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Note d'incident"
        hint={target?.status === 'resolved' ? 'Obligatoire : mesures prises, cause identifiée…' : 'Facultatif : équipe mobilisée, premières actions…'}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={error}
        rows={5}
        maxLength={NOTE_MAX}
      />
    </Modal>
  );
}

export function AlertsAdminPage() {
  const api = useApi();
  const { can } = useAuth();
  const canManage = can('alerts:manage');
  const [filters, setFilters] = useState<AlertFilterValue>({ ...EMPTY_ALERT_FILTERS, status: 'active' });
  const query = useAdminAlerts(toAlertQuery(filters));
  const [target, setTarget] = useState<{ alert: Alert; status: Exclude<AlertStatus, 'active'> } | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Alert | null>(null);

  const publish = useFeedbackMutation({
    mutationFn: (input: AlertCreate) => api.admin.createAlert(input),
    invalidate: INVALIDATE,
    successMessage: (alert) => `Alerte publiée pour ${alert.zoneName ?? 'la zone'}, abonnés notifiés.`,
    onSuccess: () => setCreating(false),
    silentError: true,
  });
  const remove = useFeedbackMutation({
    mutationFn: (id: string) => api.admin.deleteAlert(id),
    invalidate: INVALIDATE,
    successMessage: 'Alerte supprimée.',
    onSuccess: () => setDeleting(null),
  });
  const serverErrors = serverFieldErrors(publish.error);

  return (
    <div className="stack">
      <PageHeader
        title="Alertes et suivi d'incidents"
        description="Prendre en charge et résoudre les dépassements de seuils, avec traçabilité."
        actions={
          canManage && (
            <Button icon={<Megaphone size={16} aria-hidden="true" />} onClick={() => { publish.reset(); setCreating(true); }}>
              Publier une alerte
            </Button>
          )
        }
      />
      <AlertFilters value={filters} onChange={setFilters} />
      <AlertList
        query={query}
        renderExtra={(alert) =>
          alert.incidentNote || alert.handledBy ? (
            <div className="incident-note">
              <p className="small strong">Suivi d'incident</p>
              {alert.incidentNote && <p className="small">{alert.incidentNote}</p>}
              {alert.handledBy && (
                <p className="small muted">
                  Par {alert.handledBy}
                  {alert.acknowledgedAt && ` · pris en charge ${formatRelativeTime(alert.acknowledgedAt)}`}
                </p>
              )}
            </div>
          ) : null
        }
        renderActions={(alert) => (
          <>
            {alert.status === 'active' && (
              <Button size="sm" variant="secondary" icon={<Eye size={16} aria-hidden="true" />} onClick={() => setTarget({ alert, status: 'acknowledged' })}>
                {ACTION_LABELS.acknowledged}
              </Button>
            )}
            {alert.status !== 'resolved' && (
              <Button size="sm" icon={<CheckCircle2 size={16} aria-hidden="true" />} onClick={() => setTarget({ alert, status: 'resolved' })}>
                {ACTION_LABELS.resolved}
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDeleting(alert)}>
                Supprimer<span className="sr-only"> l'alerte {alert.title}</span>
              </Button>
            )}
          </>
        )}
      />
      <IncidentDialog target={target} onClose={() => setTarget(null)} />

      <Modal open={creating} title="Publier une alerte" onClose={() => setCreating(false)}>
        {creating && (
          <>
            {publish.isError && Object.keys(serverErrors).length === 0 && <p className="form-error" role="alert">{toUserMessage(publish.error)}</p>}
            <AlertForm pending={publish.isPending} serverErrors={serverErrors} onSubmit={(input) => publish.mutate(input)} onCancel={() => setCreating(false)} />
          </>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Supprimer cette alerte ?"
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
            L'alerte « {deleting.title} » sera définitivement supprimée, y compris de l'historique des abonnés. Cette action est tracée dans le journal d'audit.
          </p>
        )}
      </Modal>
    </div>
  );
}
