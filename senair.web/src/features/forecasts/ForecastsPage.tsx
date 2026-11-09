import { useState } from 'react';
import { aqiLevelRank, FORECAST_HORIZONS, formatDateTime, isShortTermHorizon, type Forecast } from '@senair/core';
import { Card } from '../../shared/ui/Card';
import { SelectField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { LevelChip } from '../../shared/ui/AqiBadge';
import { resolveLevel } from '../../shared/ui/aqi';
import { DATA_STATUS_LABELS } from '../../shared/lib/labels';
import { useZones } from '../air-quality/hooks';
import { useForecasts } from './hooks';
import { ForecastChart } from './ForecastChart';
import { ForecastList } from './ForecastList';

/** Synthèse textuelle à partir des valeurs fournies par le modèle (aucun recalcul). */
function Synthesis({ label, forecasts }: { label: string; forecasts: readonly Forecast[] }) {
  const values = forecasts.map((f) => f.aqi).filter((v): v is number => v != null);
  const worst = [...forecasts]
    .filter((f) => f.level)
    .sort((a, b) => aqiLevelRank(b.level ?? 'good') - aqiLevelRank(a.level ?? 'good'))[0];
  const info = worst ? resolveLevel(worst.aqi, worst.level) : null;
  const min = values.length ? Math.round(Math.min(...values)) : null;
  const max = values.length ? Math.round(Math.max(...values)) : null;
  return (
    <div className="forecast-summary__item">
      <span className="forecast-summary__label">{label}</span>
      {info && min != null && max != null ? (
        <>
          <p className="forecast-summary__text">IQA {min === max ? `attendu à ${min}` : `entre ${min} et ${max}`}</p>
          <div>
            <LevelChip info={info} withDot />
          </div>
          <p className="caption">{info.healthImpact}</p>
        </>
      ) : (
        <p className="forecast-summary__text">Prévision indisponible</p>
      )}
    </div>
  );
}

export function ForecastsPage() {
  const [zoneId, setZoneId] = useState('');
  const zones = useZones();
  const horizons = [...FORECAST_HORIZONS];
  const query = useForecasts(zoneId ? { scope: 'zone', scopeId: zoneId, horizons } : { scope: 'city', horizons });
  const zoneName = zones.data?.find((z) => z.id === zoneId)?.name;

  return (
    <div className="stack">
      <PageHeader
        title="Prévisions des 3 prochains jours"
        description={`Indice de qualité de l'air attendu ${zoneName ? `dans le quartier ${zoneName}` : 'à Thiès'}, de 1 heure à 3 jours, avec l'intervalle donné par le modèle.`}
        actions={
          <SelectField
            label="Secteur"
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
            placeholder="Toute la ville"
            options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          />
        }
      />
      <QueryState query={query} skeletonBlock isEmpty={(set) => set.forecasts.length === 0} emptyMessage="Aucune prévision disponible pour ce secteur.">
        {(set) => {
          const hours = set.forecasts.filter((f) => isShortTermHorizon(f.horizon));
          const days = set.forecasts.filter((f) => !isShortTermHorizon(f.horizon));
          const tomorrow = days.filter((f) => f.horizon === '1d');
          return (
            <>
              <div className="forecast-summary">
                <Synthesis label="Prochaines heures" forecasts={hours} />
                <Synthesis label="Demain" forecasts={tomorrow} />
              </div>
              <Card title="Évolution prévue">
                <ForecastChart forecasts={set.forecasts} />
              </Card>
              <div className="grid grid--2">
                <Card title="Prochaines heures">
                  <ForecastList forecasts={hours} daily={false} />
                </Card>
                <Card title="Prochains jours">
                  <ForecastList forecasts={days} daily />
                </Card>
              </div>
              <footer className="about">
                <span>
                  Modèle <strong>{set.modelName}</strong>, version {set.modelVersion}
                </span>
                <span>Calculé le {formatDateTime(set.generatedAt)}</span>
                <span>Provenance : {DATA_STATUS_LABELS[set.status]}</span>
                <span>Une prévision n'est pas une mesure ; la confiance diminue avec l'horizon.</span>
              </footer>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
