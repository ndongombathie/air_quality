import { Link } from 'react-router-dom';
import { getPollutant, MISSING_VALUE } from '@senair/core';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { ButtonLink } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { DataFreshness } from '../../shared/ui/DataFreshness';
import { EmptyState, QueryState } from '../../shared/ui/QueryState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useAuth } from '../auth/AuthProvider';
import { useAirQualitySummary } from '../air-quality/hooks';
import { LevelAdvice } from '../air-quality/components/LevelAdvice';
import { ForecastStrip } from '../forecasts/ForecastStrip';

function ZoneSummaryCard({ zoneId }: { zoneId: string }) {
  const summary = useAirQualitySummary(zoneId);
  return (
    <Card title={summary.data?.name ?? 'Zone'} titleLevel={2} actions={<Link to={`/zones/${encodeURIComponent(zoneId)}`}>Détail</Link>}>
      <QueryState query={summary}>
        {(data) => (
          <div className="stack stack--sm">
            <AqiBadge aqi={data.aqi} level={data.level} size="lg" />
            <DataFreshness observedAt={data.observedAt} freshness={data.freshness} status={data.status} />
            <p className="small">Polluant dominant : {data.dominantPollutant ? getPollutant(data.dominantPollutant)?.formula : MISSING_VALUE}</p>
            <LevelAdvice aqi={data.aqi} level={data.level} />
            <ForecastStrip zoneId={zoneId} />
          </div>
        )}
      </QueryState>
    </Card>
  );
}

export function AccountDashboardPage() {
  const { user } = useAuth();
  const zoneIds = user?.zoneIds ?? [];
  return (
    <div className="stack">
      <PageHeader title="Tableau de bord de ma zone" />
      {zoneIds.length === 0 ? (
        <EmptyState message="Vous ne suivez encore aucune zone.">
          <ButtonLink to="/mon-espace/profil">Choisir mes zones</ButtonLink>
        </EmptyState>
      ) : (
        <div className="grid grid--2">
          {zoneIds.map((zoneId) => (
            <ZoneSummaryCard key={zoneId} zoneId={zoneId} />
          ))}
        </div>
      )}
    </div>
  );
}
