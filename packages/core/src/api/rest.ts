import type { SenairApi } from './contracts';
import { ENDPOINTS as E } from './endpoints';
import type { HttpClient, Query } from './http';
import type { HistoryQuery } from './types';

const historyQuery = (q: HistoryQuery): Query => ({
  from: q.from,
  to: q.to,
  granularity: q.granularity,
  pollutants: q.pollutants,
});

/** Implémentation HTTP des ports : un appel = un endpoint, aucune logique métier. */
export function createRestApi(http: HttpClient): SenairApi {
  return {
    isMock: false,

    reference: {
      metadata: () => http.get(E.metadata),
      zones: () => http.get(E.zones),
      thresholds: () => http.get(E.thresholds),
      healthGuidance: (q) => http.get(E.healthGuidance, { query: { ...q } }),
    },

    stations: {
      list: (q = {}) =>
        http.get(E.stations, {
          query: { zoneId: q.zoneId, type: q.type, include: q.includeLatest ? 'latest' : undefined },
        }),
      get: (stationId) => http.get(E.station(stationId)),
      latest: (stationId) => http.get(E.stationLatest(stationId)),
      history: (stationId, q) => http.get(E.stationHistory(stationId), { query: historyQuery(q) }),
    },

    airQuality: {
      summary: (q = {}) => http.get(E.airQualitySummary, { query: { ...q } }),
      atLocation: (p) => http.get(E.airQualityAtLocation, { query: { lat: p.latitude, lon: p.longitude } }),
      heatmap: (q) =>
        http.get(E.airQualityHeatmap, {
          query: { layer: q.layer, at: q.at, bbox: q.bbox, resolutionM: q.resolutionM },
        }),
      zoneHistory: (zoneId, q) => http.get(E.zoneHistory(zoneId), { query: historyQuery(q) }),
      cityHistory: (q) => http.get(E.airQualityHistory, { query: historyQuery(q) }),
    },

    forecasts: {
      get: (q = {}) => http.get(E.forecasts, { query: { ...q } }),
    },

    alerts: {
      list: (q = {}) => http.get(E.alerts, { query: { ...q } }),
      get: (alertId) => http.get(E.alert(alertId)),
    },

    articles: {
      list: (q = {}) => http.get(E.articles, { query: { ...q } }),
      getBySlug: (slug) => http.get(E.article(slug)),
    },

    auth: {
      register: (r) => http.post(E.auth.register, r, { anonymous: true }),
      login: (r) => http.post(E.auth.login, r, { anonymous: true }),
      verifyMfa: (r) => http.post(E.auth.verifyMfa, r, { anonymous: true }),
      refresh: (refreshToken) =>
        http.post(E.auth.refresh, refreshToken ? { refreshToken } : undefined, { anonymous: true }),
      logout: (refreshToken) => http.post(E.auth.logout, refreshToken ? { refreshToken } : undefined),
      forgotPassword: (email) => http.post(E.auth.passwordForgot, { email }, { anonymous: true }),
      resetPassword: (r) => http.post(E.auth.passwordReset, r, { anonymous: true }),
    },

    account: {
      me: () => http.get(E.me),
      updateProfile: (u) => http.patch(E.me, u),
      deleteAccount: () => http.delete(E.me),
      notificationPreferences: () => http.get(E.meNotificationPreferences),
      updateNotificationPreferences: (p) => http.put(E.meNotificationPreferences, p),
      registerDevice: (d) => http.post(E.meDevices, d),
      unregisterDevice: (token) => http.delete(E.meDevice(token)),
      myAlerts: (q = {}) => http.get(E.meAlerts, { query: { ...q } }),
      markAlertRead: (alertId) => http.post(E.meAlertRead(alertId)),
      markAllAlertsRead: () => http.post(E.meAlertsReadAll),
      dismissAlert: (alertId) => http.delete(E.meAlert(alertId)),
    },

    admin: {
      dashboard: () => http.get(E.admin.dashboard),

      stations: () => http.get(E.admin.stations),
      createStation: (i) => http.post(E.admin.stations, i),
      updateStation: (stationId, i) => http.patch(E.admin.station(stationId), i),

      thresholds: () => http.get(E.admin.thresholds),
      createThreshold: (i) => http.post(E.admin.thresholds, i),
      updateThreshold: (thresholdId, i) => http.patch(E.admin.threshold(thresholdId), i),
      deleteThreshold: (thresholdId) => http.delete(E.admin.threshold(thresholdId)),

      alerts: (q = {}) => http.get(E.admin.alerts, { query: { ...q } }),
      updateAlert: (alertId, u) => http.patch(E.admin.alert(alertId), u),
      createAlert: (i) => http.post(E.admin.alerts, i),
      deleteAlert: (alertId) => http.delete(E.admin.alert(alertId)),

      articles: (q = {}) => http.get(E.admin.articles, { query: { ...q } }),
      article: (articleId) => http.get(E.admin.article(articleId)),
      createArticle: (i) => http.post(E.admin.articles, i),
      updateArticle: (articleId, i) => http.patch(E.admin.article(articleId), i),
      deleteArticle: (articleId) => http.delete(E.admin.article(articleId)),
      uploadMedia: (file, meta) => {
        const form = new FormData();
        form.append('file', file, meta.fileName);
        form.append('alt', meta.alt);
        return http.postForm(E.admin.media, form);
      },

      dataSources: () => http.get(E.admin.dataSources),
      updateDataSource: (sourceId, u) => http.patch(E.admin.dataSource(sourceId), u),

      models: () => http.get(E.admin.models),
      updateModel: (modelId, u) => http.patch(E.admin.model(modelId), u),

      reports: () => http.get(E.admin.reports),
      requestReport: (r) => http.post(E.admin.reports, r),

      users: (q = {}) => http.get(E.admin.users, { query: { ...q } }),
      inviteUser: (i) => http.post(E.admin.users, i),
      updateUser: (userId, u) => http.patch(E.admin.user(userId), u),

      usage: (q) => http.get(E.admin.usage, { query: q }),
      auditLogs: (q = {}) => http.get(E.admin.audit, { query: { ...q } }),
      exportData: (q) => http.post(E.admin.exports, q),
    },
  };
}
