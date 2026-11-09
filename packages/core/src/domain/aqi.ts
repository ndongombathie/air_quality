/**
 * Échelle IQA à 6 niveaux (présentation SEN-AIR §7).
 * L'IQA est calculé par le backend : le front ne fait que le classer et l'afficher.
 */
export const AQI_LEVEL_IDS = [
  'good',
  'moderate',
  'unhealthy_sensitive',
  'unhealthy',
  'very_unhealthy',
  'hazardous',
] as const;

export type AqiLevel = (typeof AQI_LEVEL_IDS)[number];

export interface AqiLevelInfo {
  id: AqiLevel;
  label: string;
  shortLabel: string;
  min: number;
  /** Borne haute incluse ; `Infinity` pour le dernier niveau. */
  max: number;
  /** Couleur normalisée (gradient vert → bordeaux, cahier des charges §7.1.1). */
  color: string;
  /** Couleur de texte lisible posée sur `color` (contraste AA). */
  onColor: string;
  /** Fond doux pour cartes et bannières. */
  surface: string;
  healthImpact: string;
}

export const AQI_LEVELS: Readonly<Record<AqiLevel, AqiLevelInfo>> = {
  good: {
    id: 'good',
    label: 'Bon',
    shortLabel: 'Bon',
    min: 0,
    max: 50,
    color: '#00A651',
    onColor: '#FFFFFF',
    surface: '#E6F6EC',
    healthImpact: 'Risque négligeable.',
  },
  moderate: {
    id: 'moderate',
    label: 'Modéré',
    shortLabel: 'Modéré',
    min: 51,
    max: 100,
    color: '#F5C400',
    onColor: '#1A1F23',
    surface: '#FFF8DB',
    healthImpact: 'Symptômes légers possibles pour les personnes sensibles.',
  },
  unhealthy_sensitive: {
    id: 'unhealthy_sensitive',
    label: 'Mauvais pour les groupes sensibles',
    shortLabel: 'Sensibles',
    min: 101,
    max: 150,
    color: '#FF7E00',
    onColor: '#1A1F23',
    surface: '#FFF0E0',
    healthImpact: 'Réduire les activités prolongées en extérieur.',
  },
  unhealthy: {
    id: 'unhealthy',
    label: 'Mauvais',
    shortLabel: 'Mauvais',
    min: 151,
    max: 200,
    color: '#E53935',
    onColor: '#FFFFFF',
    surface: '#FDE8E8',
    healthImpact: 'Toute la population peut ressentir des effets.',
  },
  very_unhealthy: {
    id: 'very_unhealthy',
    label: 'Très mauvais',
    shortLabel: 'Très mauvais',
    min: 201,
    max: 300,
    color: '#8F3F97',
    onColor: '#FFFFFF',
    surface: '#F3E5F5',
    healthImpact: 'Alerte sanitaire : limiter les sorties.',
  },
  hazardous: {
    id: 'hazardous',
    label: 'Dangereux',
    shortLabel: 'Dangereux',
    min: 301,
    max: Number.POSITIVE_INFINITY,
    color: '#7E0023',
    onColor: '#FFFFFF',
    surface: '#F8E1E7',
    healthImpact: "Rester à l'intérieur : conditions d'urgence.",
  },
};

export const AQI_SCALE: readonly AqiLevelInfo[] = AQI_LEVEL_IDS.map((id) => AQI_LEVELS[id]);

/** Classe une valeur d'IQA. Retourne `null` si la valeur est absente ou invalide. */
export function getAqiLevel(aqi: number | null | undefined): AqiLevelInfo | null {
  if (aqi == null || !Number.isFinite(aqi) || aqi < 0) return null;
  const rounded = Math.round(aqi);
  return AQI_SCALE.find((level) => rounded <= level.max) ?? AQI_LEVELS.hazardous;
}

/** Rang 0..5 d'un niveau, utile pour comparer ou filtrer « niveau minimum ». */
export function aqiLevelRank(level: AqiLevel): number {
  return AQI_LEVEL_IDS.indexOf(level);
}

export function isAtLeast(level: AqiLevel, minimum: AqiLevel): boolean {
  return aqiLevelRank(level) >= aqiLevelRank(minimum);
}
