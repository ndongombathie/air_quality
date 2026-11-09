import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Radio } from 'lucide-react';
import { ForecastStrip } from '../forecasts/ForecastStrip';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { Card } from '../../shared/ui/Card';
import { DataFreshness } from '../../shared/ui/DataFreshness';
import { MeasureGrid } from '../../shared/ui/MeasureCard';
import { useDocumentTitle } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '../../shared/lib/labels';
import type { HistoryRange } from '../../shared/lib/time';
import { useAirQualitySummary, useStations, useZoneHistory } from './hooks';
import { ActiveAlertBanner } from './components/ActiveAlertBanner';
import { AqiHero } from './components/AqiHero';
import { Comparison } from './components/Comparison';
import { HistoryChartCard } from './components/HistoryChart';
import { WeatherPanel } from './components/WeatherPanel';

export function ZonePage() {
  const { zoneId = '' } = useParams();
  const summary = useAirQualitySummary(zoneId);
  const [range, setRange] = useState<HistoryRange>('24h');
  const history = useZoneHistory(zoneId, range);
  useDocumentTitle(summary.data ? `Quartier ${summary.data.name}` : 'Quartier');

  return (
    <div className="stack">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Accueil
      </Link>
      <QueryState query={summary} loadingLabel="Chargement du quartier" skeletonBlock>
        {(data) => (
          <>
            <ActiveAlertBanner zoneId={zoneId} />
            <AqiHero
              headingLevel={1}
              eyebrow="Quartier"
              title={data.name}
              aqi={data.aqi}
              level={data.level}
              dominantPollutant={data.dominantPollutant}
              observedAt={data.observedAt}
              freshness={data.freshness}
              status={data.status}
              side={
                <>
                  <p className="eyebrow">Tendance</p>
                  <Comparison comparison={data.comparison} />
                  <p className="small">
                    <Link to="/sante">Conseils adaptés à votre profil de santé</Link>
                  </p>
                </>
              }
            />
            <div className="grid grid--2 grid--wide-left">
              <HistoryChartCard title="Évolution de l'IQA" range={range} onRangeChange={setRange} query={history} />
              <Card title="Météo">
                <WeatherPanel weather={data.weather} />
              </Card>
            </div>
            <Card title="Prévisions">
              <ForecastStrip zoneId={zoneId} />
            </Card>
            <Card title="Concentrations">
              <MeasureGrid measures={data.measures} dominant={data.dominantPollutant} />
            </Card>
            <ZoneStations zoneId={zoneId} />
          </>
        )}
      </QueryState>
    </div>
  );
}

function ZoneStations({ zoneId }: { zoneId: string }) {
  const stations = useStations({ zoneId, includeLatest: true });
  return (
    <Card title="Stations du quartier">
      <QueryState query={stations} isEmpty={(list) => list.length === 0} emptyMessage="Aucune station dans ce quartier.">
        {(list) => (
          <ul className="list">
            {list.map((station) => (
              <li key={station.id} className="list__item">
                <Radio size={18} aria-hidden="true" />
                <div className="list__main">
                  <Link to={`/stations/${encodeURIComponent(station.id)}`} className="strong">
                    {station.name}
                  </Link>
                  <p className="caption">
                    {STATION_TYPE_LABELS[station.type]}, {STATION_STATUS_LABELS[station.status].toLowerCase()}
                  </p>
                  {station.latest && <DataFreshness observedAt={station.latest.observedAt} freshness={station.latest.freshness} status={station.latest.status} />}
                </div>
                <AqiBadge aqi={station.latest?.aqi ?? null} level={station.latest?.level} size="sm" short />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Card>
  );
}
