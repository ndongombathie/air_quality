import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { formatRelativeTime, toUserMessage, type Station, type StationInput } from '@senair/core';
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
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '../../shared/lib/labels';
import { StationForm } from './components/StationForm';
import { useAdminStations } from './hooks';

const STATUS_TONE = { online: 'success', offline: 'danger', maintenance: 'warning' } as const;
const INVALIDATE = [queryKeys.admin.stations, queryKeys.stations.all, queryKeys.airQuality.all, queryKeys.admin.dashboard];

export function StationsPage() {
  const api = useApi();
  const query = useAdminStations();
  const [editing, setEditing] = useState<Station | 'new' | null>(null);
  const close = () => setEditing(null);

  const mutation = useFeedbackMutation({
    mutationFn: (input: StationInput) =>
      editing && editing !== 'new' ? api.admin.updateStation(editing.id, input) : api.admin.createStation(input),
    invalidate: INVALIDATE,
    successMessage: (station) => `Station « ${station.shortName} » enregistrée.`,
    onSuccess: close,
    silentError: true,
  });
  const serverErrors = serverFieldErrors(mutation.error);

  return (
    <div className="stack">
      <PageHeader
        title="Stations"
        description="Réseau de capteurs : création, localisation, état de fonctionnement."
        actions={
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => { mutation.reset(); setEditing('new'); }}>
            Nouvelle station
          </Button>
        }
      />
      <QueryState query={query} isEmpty={(list) => list.length === 0} emptyMessage="Aucune station enregistrée.">
        {(stations) => (
          <DataTable
            caption="Stations du réseau"
            rows={stations}
            rowKey={(s) => s.id}
            columns={[
              { key: 'name', header: 'Station', render: (s) => <Link to={`/stations/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
              { key: 'zone', header: 'Zone', render: (s) => s.zoneName },
              { key: 'type', header: 'Type', render: (s) => STATION_TYPE_LABELS[s.type] },
              { key: 'status', header: 'État', render: (s) => <Badge tone={STATUS_TONE[s.status]}>{STATION_STATUS_LABELS[s.status]}</Badge> },
              { key: 'aqi', header: 'IQA', render: (s) => <AqiBadge aqi={s.latest?.aqi ?? null} level={s.latest?.level} size="sm" short /> },
              { key: 'seen', header: 'Dernière mesure', render: (s) => formatRelativeTime(s.lastObservedAt) },
              { key: 'provider', header: 'Fournisseur', render: (s) => `${s.provider}${s.externalId ? ` #${s.externalId}` : ''}` },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                render: (s) => (
                  <Button size="sm" variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => { mutation.reset(); setEditing(s); }}>
                    Modifier<span className="sr-only"> {s.name}</span>
                  </Button>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      <Modal open={editing !== null} title={editing === 'new' ? 'Nouvelle station' : 'Modifier la station'} onClose={close}>
        {editing !== null && (
          <>
            {mutation.isError && Object.keys(serverErrors).length === 0 && <p className="form-error" role="alert">{toUserMessage(mutation.error)}</p>}
            <StationForm
              key={editing === 'new' ? 'new' : editing.id}
              station={editing === 'new' ? null : editing}
              pending={mutation.isPending}
              serverErrors={serverErrors}
              onSubmit={(input) => mutation.mutate(input)}
              onCancel={close}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
