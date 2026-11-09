/**
 * Source unique des chemins REST, relatifs à `${baseUrl}/api/v1`.
 * Toute évolution ici doit être reportée dans docs/api/openapi.yaml.
 */
const id = (value: string) => encodeURIComponent(value);

export const ENDPOINTS = {
  metadata: '/metadata',

  zones: '/zones',
  stations: '/stations',
  station: (stationId: string) => `/stations/${id(stationId)}`,
  stationLatest: (stationId: string) => `/stations/${id(stationId)}/latest`,
  stationHistory: (stationId: string) => `/stations/${id(stationId)}/history`,

  airQualitySummary: '/air-quality/summary',
  airQualityAtLocation: '/air-quality/at',
  airQualityHeatmap: '/air-quality/heatmap',
  airQualityHistory: '/air-quality/history',
  zoneHistory: (zoneId: string) => `/zones/${id(zoneId)}/history`,

  forecasts: '/forecasts',

  alerts: '/alerts',
  alert: (alertId: string) => `/alerts/${id(alertId)}`,

  thresholds: '/thresholds',
  healthGuidance: '/health-guidance',

  articles: '/articles',
  article: (slug: string) => `/articles/${id(slug)}`,

  auth: {
    register: '/auth/register',
    login: '/auth/login',
    verifyMfa: '/auth/mfa/verify',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    passwordForgot: '/auth/password/forgot',
    passwordReset: '/auth/password/reset',
  },

  me: '/me',
  meNotificationPreferences: '/me/notification-preferences',
  meDevices: '/me/devices',
  meDevice: (token: string) => `/me/devices/${id(token)}`,
  meAlerts: '/me/alerts',
  meAlertsReadAll: '/me/alerts/read-all',
  meAlert: (alertId: string) => `/me/alerts/${id(alertId)}`,
  meAlertRead: (alertId: string) => `/me/alerts/${id(alertId)}/read`,

  admin: {
    dashboard: '/admin/dashboard',
    stations: '/admin/stations',
    station: (stationId: string) => `/admin/stations/${id(stationId)}`,
    thresholds: '/admin/thresholds',
    threshold: (thresholdId: string) => `/admin/thresholds/${id(thresholdId)}`,
    alerts: '/admin/alerts',
    alert: (alertId: string) => `/admin/alerts/${id(alertId)}`,
    articles: '/admin/articles',
    article: (articleId: string) => `/admin/articles/${id(articleId)}`,
    media: '/admin/media',
    dataSources: '/admin/data-sources',
    dataSource: (sourceId: string) => `/admin/data-sources/${id(sourceId)}`,
    models: '/admin/models',
    model: (modelId: string) => `/admin/models/${id(modelId)}`,
    reports: '/admin/reports',
    users: '/admin/users',
    user: (userId: string) => `/admin/users/${id(userId)}`,
    usage: '/admin/analytics/usage',
    audit: '/admin/audit-logs',
    exports: '/admin/exports',
  },
} as const;
