import { MISSING_VALUE, formatMeasure, formatPercent, type AirQualitySummary, type LocationAirQuality } from '@senair/core';

export interface CurrentAirView {
  title: string;
  subtitle: string;
  source: AirQualitySummary | LocationAirQuality;
}

/** Choisit la donnée affichée : position de l'utilisateur si disponible, sinon synthèse ville. */
export function selectCurrentAir(summary: AirQualitySummary | undefined, local: LocationAirQuality | undefined): CurrentAirView | null {
  if (local) {
    const distance =
      local.distanceToNearestStationM == null ? MISSING_VALUE : `${formatMeasure(local.distanceToNearestStationM / 1000, 1)} km`;
    return {
      title: 'Près de vous',
      subtitle: `${local.zoneName ?? 'Zone inconnue'}, station la plus proche à ${distance}, confiance ${formatPercent(local.confidence)}`,
      source: local,
    };
  }
  if (summary) {
    return {
      title: `Qualité de l'air à ${summary.name}`,
      subtitle: `${summary.stationsReporting} stations actives sur ${summary.stationsTotal}`,
      source: summary,
    };
  }
  return null;
}
