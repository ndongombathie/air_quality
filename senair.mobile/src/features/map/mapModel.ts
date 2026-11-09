/** Conversion DTO → données d'affichage de la carte (présentation uniquement). */
import { AQI_LEVELS, getAqiLevel, type Station } from '@senair/core';
import { formatAqi } from '@/shared/format/display';
import { COLORS } from '@/theme';
import type { MapStationMarker } from './leaflet/protocol';

export function toStationMarkers(stations: Station[]): MapStationMarker[] {
  return stations.map((s) => {
    const latest = s.latest ?? null;
    const info = latest?.level ? AQI_LEVELS[latest.level] : getAqiLevel(latest?.aqi);
    const label = formatAqi(latest?.aqi);
    return {
      id: s.id,
      name: s.shortName,
      latitude: s.location.latitude,
      longitude: s.location.longitude,
      label,
      title: `${s.name}, IQA ${label}${info ? `, ${info.label}` : ''}`,
      /** Anneau : couleur du niveau ; chiffre : encre foncée (jamais de bloc saturé). */
      color: info?.color ?? COLORS.textDisabled,
      textColor: COLORS.text,
    };
  });
}
