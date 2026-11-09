/**
 * Protocole de messages RN ⇄ WebView Leaflet.
 * Les données ne sont JAMAIS concaténées dans le HTML : elles transitent en JSON
 * (`JSON.stringify`) via `injectJavaScript`, et chaque message entrant est validé.
 */

export interface MapStationMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Texte affiché dans le marqueur (IQA ou « N/D »). */
  label: string;
  /** Libellé accessible (nom + niveau). */
  title: string;
  color: string;
  textColor: string;
}

export interface MapHeatCell {
  latitude: number;
  longitude: number;
  color: string;
}

export type ToMapMessage =
  | { type: 'init'; center: { latitude: number; longitude: number }; zoom: number }
  | { type: 'stations'; stations: MapStationMarker[] }
  | { type: 'heatmap'; cells: MapHeatCell[]; halfLat: number; halfLon: number; opacity: number }
  | { type: 'user'; position: { latitude: number; longitude: number } | null }
  | { type: 'focus'; center: { latitude: number; longitude: number }; zoom: number };

export type FromMapMessage = { type: 'ready' } | { type: 'station:select'; id: string };

/** Script injecté : la charge utile est un littéral de chaîne JSON, jamais du code. */
export function toInjectedScript(message: ToMapMessage): string {
  const payload = JSON.stringify(JSON.stringify(message));
  return `window.__senair && window.__senair.receive(${payload}); true;`;
}

/** Valide un message provenant de la WebView. Retourne `null` s'il est inconnu ou malformé. */
export function parseMapMessage(raw: string, knownStationIds: ReadonlySet<string>): FromMapMessage | null {
  if (raw.length > 2_000) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.type === 'ready') return { type: 'ready' };
  if (record.type === 'station:select' && typeof record.id === 'string' && knownStationIds.has(record.id)) {
    return { type: 'station:select', id: record.id };
  }
  return null;
}
