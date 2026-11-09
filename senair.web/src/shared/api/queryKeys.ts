import type {
  AlertQuery,
  ArticleQuery,
  AuditQuery,
  ForecastQuery,
  GeoPoint,
  HealthProfileId,
  HeatmapQuery,
  HistoryQuery,
  Station,
  UserQuery,
} from '@senair/core';

/**
 * Clés TanStack Query centralisées : préfixes hiérarchiques pour une invalidation ciblée.
 * `account` et `admin` sont purgés à la déconnexion.
 */
export const queryKeys = {
  reference: {
    metadata: ['reference', 'metadata'] as const,
    zones: ['reference', 'zones'] as const,
    thresholds: ['reference', 'thresholds'] as const,
    healthGuidance: (profile: HealthProfileId | null) => ['reference', 'health-guidance', profile ?? 'all'] as const,
  },
  stations: {
    all: ['stations'] as const,
    list: (query: { zoneId?: string; type?: Station['type']; includeLatest?: boolean }) =>
      ['stations', 'list', query] as const,
    detail: (stationId: string) => ['stations', 'detail', stationId] as const,
    history: (stationId: string, query: HistoryQuery) => ['stations', 'history', stationId, query] as const,
  },
  airQuality: {
    all: ['air-quality'] as const,
    summary: (zoneId: string | null) => ['air-quality', 'summary', zoneId ?? 'city'] as const,
    atLocation: (point: GeoPoint) => ['air-quality', 'at', point.latitude, point.longitude] as const,
    heatmap: (query: HeatmapQuery) => ['air-quality', 'heatmap', query] as const,
    zoneHistory: (zoneId: string, query: HistoryQuery) => ['air-quality', 'zone-history', zoneId, query] as const,
    cityHistory: (query: HistoryQuery) => ['air-quality', 'city-history', query] as const,
  },
  forecasts: {
    get: (query: ForecastQuery) => ['forecasts', query] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (query: AlertQuery) => ['alerts', 'list', query] as const,
  },
  articles: {
    all: ['articles'] as const,
    list: (query: ArticleQuery) => ['articles', 'list', query] as const,
    detail: (slug: string) => ['articles', 'detail', slug] as const,
  },
  account: {
    all: ['me'] as const,
    profile: ['me', 'profile'] as const,
    preferences: ['me', 'notification-preferences'] as const,
    alerts: (query: AlertQuery) => ['me', 'alerts', query] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboard: ['admin', 'dashboard'] as const,
    stations: ['admin', 'stations'] as const,
    thresholds: ['admin', 'thresholds'] as const,
    alerts: (query: AlertQuery) => ['admin', 'alerts', query] as const,
    alertsAll: ['admin', 'alerts'] as const,
    articles: (query: ArticleQuery) => ['admin', 'articles', query] as const,
    articlesAll: ['admin', 'articles'] as const,
    article: (articleId: string) => ['admin', 'article', articleId] as const,
    dataSources: ['admin', 'data-sources'] as const,
    models: ['admin', 'models'] as const,
    reports: ['admin', 'reports'] as const,
    users: (query: UserQuery) => ['admin', 'users', query] as const,
    usersAll: ['admin', 'users'] as const,
    usage: (query: { from: string; to: string }) => ['admin', 'usage', query] as const,
    audit: (query: AuditQuery) => ['admin', 'audit', query] as const,
    auditAll: ['admin', 'audit'] as const,
  },
};
