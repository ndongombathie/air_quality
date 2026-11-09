import { Link } from 'react-router-dom';
import type { Station } from '@senair/core';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { DataTable } from '../../shared/ui/DataTable';
import { formatRelativeTime } from '@senair/core';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '../../shared/lib/labels';

/** Alternative textuelle à la carte (lecteurs d'écran, navigation clavier, carte indisponible). */
export function StationFallbackList({ stations }: { stations: readonly Station[] }) {
  return (
    <DataTable
      caption="Liste des stations et IQA courant"
      rows={stations}
      rowKey={(s) => s.id}
      columns={[
        { key: 'name', header: 'Station', render: (s) => <Link to={`/stations/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
        { key: 'zone', header: 'Zone', render: (s) => s.zoneName },
        { key: 'type', header: 'Type', render: (s) => STATION_TYPE_LABELS[s.type] },
        { key: 'aqi', header: 'IQA', render: (s) => <AqiBadge aqi={s.latest?.aqi ?? null} level={s.latest?.level} size="sm" short /> },
        { key: 'status', header: 'État', render: (s) => STATION_STATUS_LABELS[s.status] },
        { key: 'at', header: 'Mesure', render: (s) => formatRelativeTime(s.latest?.observedAt ?? s.lastObservedAt) },
      ]}
    />
  );
}
