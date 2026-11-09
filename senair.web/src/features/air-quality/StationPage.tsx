import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatDateTime } from '@senair/core';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { MeasureGrid } from '../../shared/ui/MeasureCard';
import { useDocumentTitle } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '../../shared/lib/labels';
import type { HistoryRange } from '../../shared/lib/time';
import { useStation, useStationHistory } from './hooks';
import { AqiHero } from './components/AqiHero';
import { HistoryChartCard } from './components/HistoryChart';
import { WeatherPanel } from './components/WeatherPanel';

const STATUS_TONE = { online: 'success', maintenance: 'warning', offline: 'danger' } as const;

export function StationPage() {
  const { stationId = '' } = useParams();
  const station = useStation(stationId);
  const [range, setRange] = useState<HistoryRange>('24h');
  const history = useStationHistory(stationId, range);
  useDocumentTitle(station.data ? `Station ${station.data.shortName}` : 'Station');

  return (
    <div className="stack">
      <Link to="/carte" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Carte
      </Link>
      <QueryState query={station} loadingLabel="Chargement de la station" skeletonBlock>
        {(data) => {
          const latest = data.latest ?? null;
          return (
            <>
              <AqiHero
                headingLevel={1}
                eyebrow={`Station, quartier ${data.zoneName}`}
                title={data.name}
                aqi={latest?.aqi ?? null}
                level={latest?.level ?? null}
                dominantPollutant={latest?.dominantPollutant ?? null}
                observedAt={latest?.observedAt ?? null}
                freshness={latest?.freshness ?? 'unknown'}
                status={latest?.status ?? 'measured'}
                side={
                  <>
                    <div className="row">
                      <Badge tone={STATUS_TONE[data.status]}>{STATION_STATUS_LABELS[data.status]}</Badge>
                      <Badge>{STATION_TYPE_LABELS[data.type]}</Badge>
                    </div>
                    <dl className="kv">
                      <div>
                        <dt>Fournisseur</dt>
                        <dd>{data.provider}</dd>
                      </div>
                      <div>
                        <dt>Dernière observation</dt>
                        <dd>{formatDateTime(data.lastObservedAt)}</dd>
                      </div>
                      <div>
                        <dt>Coordonnées</dt>
                        <dd>
                          {data.location.latitude.toFixed(4)}, {data.location.longitude.toFixed(4)}
                        </dd>
                      </div>
                    </dl>
                    <Link to={`/zones/${encodeURIComponent(data.zoneId)}`}>Voir le quartier {data.zoneName}</Link>
                  </>
                }
              />
              <Card title="Mesures de la station">
                <p className="small muted">
                  La provenance de chaque valeur est indiquée sous la carte : capteur de la station, ou donnée commune à toute la ville (OpenWeatherMap).
                </p>
                <MeasureGrid measures={latest?.measures ?? []} dominant={latest?.dominantPollutant} />
              </Card>
              <div className="grid grid--2 grid--wide-left">
                <HistoryChartCard title="Évolution de l'IQA" range={range} onRangeChange={setRange} query={history} />
                <Card title="Météo locale">
                  <WeatherPanel weather={latest?.weather ?? null} />
                </Card>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
