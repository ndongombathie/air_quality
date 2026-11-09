import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { DesignTokens, POLLUTANTS, POLLUTANT_CODES, THIES_CENTER, formatRelativeTime, type HeatmapQuery, type StationType } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { CheckboxField, SelectField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AqiLegend } from '../../shared/ui/AqiLegend';
import { ErrorState, LoadingState, QueryState } from '../../shared/ui/QueryState';
import { DATA_STATUS_LABELS, STATION_TYPE_LABELS, optionsOf } from '../../shared/lib/labels';
import { useGeolocation } from '../../shared/hooks/useGeolocation';
import { useStations } from '../air-quality/hooks';
import { useAirQualityAt, useHeatmap } from './hooks';
import { StationLayer } from './StationLayer';
import { HeatmapLayer } from './HeatmapLayer';
import { LocateResult } from './LocateResult';
import { StationFallbackList } from './StationFallbackList';

const LAYER_OPTIONS = [
  { value: 'aqi', label: 'IQA global' },
  ...POLLUTANT_CODES.map((code) => ({ value: code, label: POLLUTANTS[code].formula })),
];

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function MapPage() {
  const [type, setType] = useState<StationType | ''>('');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [layer, setLayer] = useState<HeatmapQuery['layer']>('aqi');
  const stations = useStations({ includeLatest: true, ...(type ? { type } : {}) });
  const heatmap = useHeatmap(layer, showHeatmap);
  const { state: geo, locate } = useGeolocation();
  const point = geo.status === 'success' ? geo.point : null;
  const atLocation = useAirQualityAt(point);

  return (
    <div className="stack">
      <PageHeader title="Carte de la qualité de l'air" description="Stations de mesure de Thiès, IQA en temps réel et couche interpolée." />
      <div className="map-toolbar">
        <SelectField
          label="Type de station"
          value={type}
          onChange={(event) => setType(event.target.value as StationType | '')}
          placeholder="Tous les types"
          options={optionsOf(STATION_TYPE_LABELS)}
        />
        <CheckboxField label="Couche interpolée" checked={showHeatmap} onChange={(event) => setShowHeatmap(event.target.checked)} />
        <SelectField
          label="Grandeur de la couche"
          value={layer}
          disabled={!showHeatmap}
          onChange={(event) => setLayer(event.target.value as HeatmapQuery['layer'])}
          options={LAYER_OPTIONS}
        />
        <Button
          variant="secondary"
          icon={<LocateFixed size={16} aria-hidden="true" />}
          loading={geo.status === 'locating'}
          onClick={locate}
        >
          Ma position
        </Button>
      </div>

      {geo.status === 'error' && <p className="field__error" role="alert">{geo.message}</p>}
      {point && (atLocation.isPending ? <LoadingState label="Estimation à votre position" lines={2} /> : atLocation.isError ? <ErrorState error={atLocation.error} onRetry={() => void atLocation.refetch()} /> : <LocateResult result={atLocation.data} />)}

      <div className="map-frame">
        <MapContainer center={[THIES_CENTER.latitude, THIES_CENTER.longitude]} zoom={13} scrollWheelZoom className="map" aria-label="Carte des stations">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={OSM_ATTRIBUTION} maxZoom={19} />
          {showHeatmap && heatmap.data && <HeatmapLayer heatmap={heatmap.data} />}
          {stations.data && <StationLayer stations={stations.data} />}
          {point && (
            <CircleMarker center={[point.latitude, point.longitude]} radius={8} pathOptions={{ color: DesignTokens.PALETTE.white, weight: 3, fillColor: DesignTokens.PALETTE.sky600, fillOpacity: 1 }} />
          )}
        </MapContainer>
        {stations.isPending && (
          <div className="map-overlay" role="status">
            <span className="row small">
              <span className="spinner" aria-hidden="true" /> Chargement des stations
            </span>
          </div>
        )}
      </div>

      <div className="map-meta">
        <AqiLegend compact />
        {showHeatmap && heatmap.isPending && <p className="muted small" role="status">Calcul de la couche interpolée…</p>}
        {showHeatmap && heatmap.isError && <ErrorState error={heatmap.error} onRetry={() => void heatmap.refetch()} />}
        {showHeatmap && heatmap.data && (
          <p className="muted small">
            Couche interpolée ({DATA_STATUS_LABELS[heatmap.data.status].toLowerCase()}), méthode {heatmap.data.method.toUpperCase()}, modèle {heatmap.data.modelVersion}, résolution{' '}
            {heatmap.data.resolutionM} m, calculée {formatRelativeTime(heatmap.data.generatedAt)}. Entre les stations, les valeurs sont des estimations.
          </p>
        )}
      </div>

      <section aria-labelledby="stations-list-title">
        <h2 id="stations-list-title" className="h3">Liste des stations</h2>
        <QueryState query={stations} isEmpty={(list) => list.length === 0} emptyMessage="Aucune station pour ce filtre.">
          {(list) => <StationFallbackList stations={list} />}
        </QueryState>
      </section>
    </div>
  );
}
