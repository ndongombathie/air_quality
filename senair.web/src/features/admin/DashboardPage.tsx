import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, FileText, Radio, Users } from 'lucide-react';
import { AQI_LEVELS, formatRelativeTime, MISSING_VALUE, type AdminDashboard } from '@senair/core';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { Card } from '../../shared/ui/Card';
import { KpiTile } from '../../shared/ui/KpiTile';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import type { HistoryRange } from '../../shared/lib/time';
import { ZoneRankingList } from '../air-quality/components/ZoneRankingList';
import { HistoryChartCard } from '../air-quality/components/HistoryChart';
import { useCityHistory } from '../air-quality/hooks';
import { useAuth } from '../auth/AuthProvider';
import { useAdminDashboard } from './hooks';

function AlertsByLevel({ byLevel }: { byLevel: AdminDashboard['alerts']['byLevel'] }) {
  const max = Math.max(1, ...byLevel.map((entry) => entry.count));
  if (byLevel.length === 0) return <p className="muted">Aucune alerte sur 24 heures.</p>;
  return (
    <ul className="bars">
      {byLevel.map(({ level, count }) => (
        <li key={level} className="bars__row">
          <span className="bars__label">
            <span className="level-dot" aria-hidden="true" style={{ backgroundColor: AQI_LEVELS[level].color }} />
            {AQI_LEVELS[level].label}
          </span>
          <span className="bars__track" aria-hidden="true">
            <span className="bars__fill" style={{ width: `${(count / max) * 100}%`, backgroundColor: AQI_LEVELS[level].color }} />
          </span>
          <span className="bars__value">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function SourcesHealth({ sources }: { sources: AdminDashboard['dataSources'] }) {
  const rows = [
    { label: 'Opérationnelles', value: sources.healthy, tone: 'success' },
    { label: 'Dégradées', value: sources.degraded, tone: 'warning' },
    { label: 'En panne', value: sources.down, tone: 'danger' },
  ] as const;
  return (
    <ul className="list">
      {rows.map((row) => (
        <li key={row.label} className="list__item">
          <span className={`badge badge--${row.tone}`}>{row.label}</span>
          <span className="list__main" />
          <strong className="num">{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const query = useAdminDashboard();
  const { can } = useAuth();
  const [range, setRange] = useState<HistoryRange>('24h');
  const history = useCityHistory(range);
  return (
    <div className="stack">
      <PageHeader
        title="Tableau de bord"
        description={query.data ? `Vue d'ensemble du réseau de Thiès, mise à jour ${formatRelativeTime(query.data.generatedAt)}.` : "Vue d'ensemble du réseau de Thiès."}
      />
      <QueryState query={query} loadingLabel="Chargement du tableau de bord" skeletonBlock>
        {(data) => (
          <>
            <div className="kpi-grid">
              <KpiTile label="IQA de la ville" value={<AqiBadge aqi={data.cityAqi} level={data.cityLevel} size="lg" short />} detail={`Maximum relevé : ${data.maxAqi ?? MISSING_VALUE}`} />
              <KpiTile
                icon={<Radio size={18} />}
                label="Stations en ligne"
                value={`${data.stations.online} / ${data.stations.total}`}
                detail={`${data.stations.offline} hors ligne, ${data.stations.maintenance} en maintenance`}
              />
              <KpiTile icon={<Bell size={18} />} label="Alertes en cours" value={data.alerts.active} detail={`${data.alerts.acknowledged} prises en charge, ${data.alerts.last24h} sur 24 h`} />
              <KpiTile icon={<FileText size={18} />} label="Articles publiés" value={data.articles.published} detail={`${data.articles.drafts} brouillon${data.articles.drafts > 1 ? 's' : ''}`} />
              <KpiTile icon={<Users size={18} />} label="Utilisateurs" value={data.users.total} detail={`${data.users.newLast7d} nouveaux sur 7 jours`} />
            </div>
            <div className="grid grid--2 grid--wide-left">
              <HistoryChartCard title="IQA de la ville" range={range} onRangeChange={setRange} query={history} />
              <Card title="Quartiers les plus exposés">
                <ZoneRankingList zones={data.topZones} />
              </Card>
            </div>
            <div className="grid grid--2">
              <Card title="Alertes par niveau, 24 h" actions={can('alerts:manage') && <Link to="/admin/alertes">Gérer les alertes</Link>}>
                <AlertsByLevel byLevel={data.alerts.byLevel} />
              </Card>
              <Card title="Sources de données" actions={can('sources:manage') && <Link to="/admin/sources">Détail</Link>}>
                <SourcesHealth sources={data.dataSources} />
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
