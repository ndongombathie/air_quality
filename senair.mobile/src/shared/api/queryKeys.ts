/**
 * Clés TanStack Query centralisées. Toute clé de données personnelles commence par `account`
 * (purgées à la déconnexion).
 */
import type {
  AlertQuery,
  AqiLevel,
  ArticleQuery,
  ForecastQuery,
  GeoPoint,
  HealthProfileId,
  HeatmapQuery,
  HistoryQuery,
} from '@senair/core';

export type HistoryScope = { kind: 'city' } | { kind: 'zone' | 'station'; id: string };

export const queryKeys = {
  reference: {
    zones: () => ['reference', 'zones'] as const,
    thresholds: () => ['reference', 'thresholds'] as const,
    healthGuidance: (profile: HealthProfileId | null, level: AqiLevel | null) =>
      ['reference', 'healthGuidance', profile, level] as const,
  },
  airQuality: {
    summary: (zoneId: string | null) => ['airQuality', 'summary', zoneId] as const,
    atLocation: (point: GeoPoint) =>
      // Arrondi ~100 m : évite une nouvelle requête à chaque micro-variation GPS.
      ['airQuality', 'atLocation', point.latitude.toFixed(3), point.longitude.toFixed(3)] as const,
    heatmap: (query: HeatmapQuery) => ['airQuality', 'heatmap', query] as const,
    history: (scope: HistoryScope, query: HistoryQuery) => ['airQuality', 'history', scope, query] as const,
  },
  stations: {
    list: () => ['stations', 'list', { includeLatest: true }] as const,
    detail: (stationId: string) => ['stations', 'detail', stationId] as const,
  },
  forecasts: {
    get: (query: ForecastQuery) => ['forecasts', query] as const,
  },
  alerts: {
    list: (query: AlertQuery) => ['alerts', 'list', query] as const,
    active: () => ['alerts', 'active'] as const,
  },
  articles: {
    list: (query: ArticleQuery) => ['articles', 'list', query] as const,
    detail: (slug: string) => ['articles', 'detail', slug] as const,
  },
  account: {
    me: () => ['account', 'me'] as const,
    notificationPreferences: () => ['account', 'notificationPreferences'] as const,
    myAlerts: (query: AlertQuery) => ['account', 'myAlerts', query] as const,
    myAlertsAll: () => ['account', 'myAlerts'] as const,
    unreadAlerts: () => ['account', 'myAlerts', 'unreadCount'] as const,
  },
} as const;
