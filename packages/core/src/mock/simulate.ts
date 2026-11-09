/**
 * Générateur déterministe : mêmes entrées (station, heure) ⇒ mêmes valeurs.
 * Le mock simule ici le calcul backend (IQA = max des sous-indices, présentation §8)
 * pour que les données de démonstration soient cohérentes ; le front ne réutilise pas ces fonctions.
 */
import { getAqiLevel } from '../domain/aqi';
import { getFreshness } from '../domain/format';
import { POLLUTANTS, type MeasureCode, type PollutantCode } from '../domain/pollutants';
import { findReferenceThreshold } from '../domain/thresholds';
import type { AirQualitySnapshot, Measure, Weather } from '../api/types';

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bruit pseudo-aléatoire stable dans [-1, 1]. */
export function noise(...parts: (string | number)[]): number {
  return (hash(parts.join('|')) / 0xffffffff) * 2 - 1;
}

/** Pics de trafic 8 h et 19 h, creux en milieu de nuit. */
export function diurnalFactor(hour: number): number {
  const morning = Math.exp(-((hour - 8) ** 2) / 6);
  const evening = Math.exp(-((hour - 19) ** 2) / 8);
  return 0.75 + 0.35 * morning + 0.3 * evening;
}

const HOUR = 3_600_000;
export const hourIndex = (at: Date) => Math.floor(at.getTime() / HOUR);

const limitFor = (code: PollutantCode) => findReferenceThreshold(code, 'WHO_2021')?.value ?? 1;

/**
 * Reproduit la structure des données réelles (projet-transversal/air_quality.csv) :
 * PM, CO₂ et COV viennent du capteur de chaque station ; CO, NO, NO₂, SO₂, O₃ et NH₃
 * viennent d'OpenWeatherMap à l'échelle de la ville (valeurs identiques pour toutes les stations).
 */
export function simulateMeasures(stationId: string, baseAqi: number, at: Date): Measure[] {
  const h = hourIndex(at);
  const local = Math.max(8, baseAqi * diurnalFactor(at.getHours()) + noise(stationId, h) * 14);
  const city = Math.max(20, 62 * diurnalFactor(at.getHours()) + noise('city', h) * 6);
  // Concentrations exprimées en fraction du seuil OMS (sous-indice / 100).
  const ratios: Record<PollutantCode, number> = {
    pm25: (local / 100) * (0.95 + noise(stationId, h, 'pm25') * 0.05),
    pm10: (local / 100) * (0.7 + noise(stationId, h, 'pm10') * 0.15),
    no2: (city / 100) * 0.05,
    so2: (city / 100) * 0.03,
    co: (city / 100) * 0.03,
    o3: city / 100,
  };
  const fromSensor = (code: PollutantCode) => code === 'pm25' || code === 'pm10';
  const measures: Measure[] = (Object.keys(ratios) as PollutantCode[]).map((code) => {
    const value = Math.max(0, ratios[code] * limitFor(code));
    return {
      code,
      value: Math.round(value * 100) / 100,
      unit: POLLUTANTS[code].unit,
      source: fromSensor(code) ? 'sensor' : 'openweathermap',
      subIndex: Math.round(ratios[code] * 100),
    };
  });
  const aux: [MeasureCode, number, Measure['source']][] = [
    ['co2', 400 + local * 1.5 + noise(stationId, h, 'co2') * 40, 'sensor'],
    ['tvoc', 60 + local + noise(stationId, h, 'tvoc') * 30, 'sensor'],
    ['no', 0.02, 'openweathermap'],
    ['nh3', 0, 'openweathermap'],
  ];
  for (const [code, value, source] of aux) {
    measures.push({ code, value: Math.round(value * 100) / 100, unit: POLLUTANTS[code].unit, source, subIndex: null });
  }
  return measures;
}

export function simulateWeather(stationId: string, at: Date): Weather {
  const h = hourIndex(at);
  const hour = at.getHours();
  const daylight = Math.sin(((hour - 6) / 24) * Math.PI * 2);
  return {
    temperatureC: Math.round((29 + daylight * 5 + noise(stationId, h, 't') * 1.5) * 10) / 10,
    humidityPct: Math.round(55 - daylight * 15 + noise(stationId, h, 'rh') * 5),
    windSpeedMs: Math.round((7.1 + noise('wind', h) * 1.5) * 100) / 100,
    windDirectionDeg: Math.round(((234 + noise('wdir', h) * 15) + 360) % 360),
    pressureHpa: Math.round(1011 + noise('p', h) * 3),
    precipitationMm: 0,
    source: 'mock',
    observedAt: at.toISOString(),
  };
}

export function aqiFromMeasures(measures: Measure[]): { aqi: number | null; dominant: PollutantCode | null } {
  let best: Measure | null = null;
  for (const m of measures) {
    if (m.subIndex == null) continue;
    if (!best || m.subIndex > (best.subIndex ?? -1)) best = m;
  }
  return best ? { aqi: best.subIndex, dominant: best.code as PollutantCode } : { aqi: null, dominant: null };
}

export function simulateSnapshot(stationId: string, baseAqi: number, at: Date, now = new Date()): AirQualitySnapshot {
  const measures = simulateMeasures(stationId, baseAqi, at);
  const { aqi, dominant } = aqiFromMeasures(measures);
  const observedAt = at.toISOString();
  return {
    aqi,
    level: getAqiLevel(aqi)?.id ?? null,
    dominantPollutant: dominant,
    measures,
    weather: simulateWeather(stationId, at),
    observedAt,
    status: 'mock',
    freshness: getFreshness(observedAt, now),
  };
}
