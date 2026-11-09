import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Map } from 'lucide-react';
import type { AirQualitySummary } from '@senair/core';
import { useAuth } from '../auth/AuthProvider';
import { ForecastStrip } from '../forecasts/ForecastStrip';
import { ButtonLink } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { MeasureGrid } from '../../shared/ui/MeasureCard';
import { useDocumentTitle } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { Skeleton } from '../../shared/ui/Skeleton';
import type { HistoryRange } from '../../shared/lib/time';
import { useAirQualitySummary, useCityHistory, useZones } from './hooks';
import { ActiveAlertBanner } from './components/ActiveAlertBanner';
import { AqiHero } from './components/AqiHero';
import { Comparison } from './components/Comparison';
import { HistoryChartCard } from './components/HistoryChart';
import { WeatherPanel } from './components/WeatherPanel';
import { ZoneQuickLinks } from './components/ZoneQuickLinks';
import { ZoneRankingList } from './components/ZoneRankingList';

function HeroSide({ summary }: { summary: AirQualitySummary }) {
  return (
    <>
      <p className="eyebrow">Tendance</p>
      <Comparison comparison={summary.comparison} />
      <p className="eyebrow">Réseau</p>
      <p className="small">
        <strong className="num">
          {summary.stationsReporting} / {summary.stationsTotal}
        </strong>{' '}
        stations transmettent des données. <Link to="/carte">Voir la carte</Link>
      </p>
      <p className="small">
        <Link to="/sante">Conseils adaptés à votre profil de santé</Link>
      </p>
    </>
  );
}

function HeroSkeleton() {
  return (
    <section className="home-hero" role="status" aria-live="polite">
      <span className="sr-only">Chargement de l'indice de qualité de l'air</span>
      <div className="home-hero__main">
        <Skeleton variant="short" />
        <Skeleton variant="title" />
        <Skeleton variant="block" />
        <Skeleton />
      </div>
      <Skeleton variant="block" />
    </section>
  );
}

export function HomePage() {
  useDocumentTitle('Accueil');
  const { user } = useAuth();
  const summary = useAirQualitySummary();
  const zones = useZones();
  const [range, setRange] = useState<HistoryRange>('24h');
  const history = useCityHistory(range);

  return (
    <div className="stack">
      <h1 className="sr-only">Qualité de l'air à Thiès</h1>
      <ActiveAlertBanner />
      {summary.isPending ? (
        <HeroSkeleton />
      ) : (
        <QueryState query={summary}>
          {(data) => (
            <AqiHero
              eyebrow="Thiès, en ce moment"
              title={`Qualité de l'air : ${data.name}`}
              aqi={data.aqi}
              level={data.level}
              dominantPollutant={data.dominantPollutant}
              observedAt={data.observedAt}
              freshness={data.freshness}
              status={data.status}
              side={<HeroSide summary={data} />}
            />
          )}
        </QueryState>
      )}

      <Card title="IQA par quartier" actions={<ButtonLink to="/carte" variant="ghost" size="sm" icon={<Map size={16} aria-hidden="true" />}>Carte</ButtonLink>}>
        {zones.data ? <ZoneQuickLinks zones={zones.data} highlighted={user?.zoneIds ?? []} /> : <Skeleton />}
      </Card>

      <div className="grid grid--2 grid--wide-left">
        <HistoryChartCard title="Évolution de l'IQA à Thiès" range={range} onRangeChange={setRange} query={history} />
        <Card title="Quartiers les plus exposés">
          {summary.data ? <ZoneRankingList zones={summary.data.worstZones} /> : <Skeleton variant="block" />}
        </Card>
      </div>

      <div className="grid grid--2 grid--wide-left">
        <Card title="Prévisions" actions={<Link to="/previsions">Détail</Link>}>
          <ForecastStrip />
        </Card>
        <Card title="Météo">{summary.data ? <WeatherPanel weather={summary.data.weather} /> : <Skeleton variant="block" />}</Card>
      </div>

      {summary.data && (
        <Card title="Concentrations mesurées">
          <MeasureGrid measures={summary.data.measures} dominant={summary.data.dominantPollutant} />
        </Card>
      )}
    </div>
  );
}
