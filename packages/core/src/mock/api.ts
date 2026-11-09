import { AQI_LEVELS, getAqiLevel, isAtLeast, type AqiLevel } from '../domain/aqi';
import { mediaKindOf, validateMediaFile } from '../domain/media';
import { toCsv, toDownloadUrl, toPdf, type PdfLine } from './files';
import { FORECAST_HORIZONS, type ForecastHorizon } from '../domain/forecast';
import { POLLUTANT_CODES, POLLUTANTS, type PollutantCode } from '../domain/pollutants';
import { hasPermission, ROLE_PERMISSIONS, type Permission } from '../auth/permissions';
import { ApiError } from '../api/errors';
import type { SenairApi } from '../api/contracts';
import type {
  Alert,
  AlertQuery,
  Article,
  ArticleInput,
  ArticleSummary,
  AuditLogEntry,
  DownloadLink,
  ExportQuery,
  Forecast,
  GeoPoint,
  MediaAsset,
  ReportRequest,
  HistoryQuery,
  HistoryPoint,
  Me,
  NotificationPreferences,
  Page,
  Report,
  Session,
  Station,
  Threshold,
  User,
} from '../api/types';
import {
  MOCK_OTP,
  MOCK_PASSWORD,
  MOCK_STATIONS,
  MOCK_ZONES,
  createMockArticles,
  createMockDataSources,
  createMockGuidance,
  createMockModels,
  createMockThresholds,
  createMockUsers,
  zoneIdOf,
} from './fixtures';
import { diurnalFactor, noise, simulateSnapshot } from './simulate';

export interface MockApiConfig {
  /** Latence simulée (ms) pour rendre visibles les états de chargement. */
  latencyMs?: number;
  /** Même source de jeton que le client HTTP réel. */
  getAccessToken?: () => string | null | Promise<string | null>;
  now?: () => Date;
}

const HOUR = 3_600_000;
const tokenFor = (userId: string) => `mock-access.${userId}`;
const refreshFor = (userId: string) => `mock-refresh.${userId}`;
const userIdFrom = (token: string | null | undefined, prefix: string) =>
  token?.startsWith(prefix) ? token.slice(prefix.length) : null;

function paginate<T>(items: T[], cursor?: string, limit = 20): Page<T> {
  const start = cursor ? Number(cursor) || 0 : 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next, total: items.length };
}

function slugify(value: string): string {
  return zoneIdOf(value).slice(0, 80);
}

function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const summarize = ({ content: _content, ...rest }: Article): ArticleSummary => rest;

export function createMockApi(config: MockApiConfig = {}): SenairApi {
  const latency = config.latencyMs ?? 250;
  const now = config.now ?? (() => new Date());
  const delay = <T>(value: T | (() => T)): Promise<T> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(typeof value === 'function' ? (value as () => T)() : value);
        } catch (error) {
          reject(error);
        }
      }, latency),
    );

  /* ─── État en mémoire ─── */
  const users = createMockUsers();
  const articles = createMockArticles();
  const thresholds = createMockThresholds();
  const dataSources = createMockDataSources();
  const models = createMockModels();
  const guidance = createMockGuidance();
  const reports: Report[] = [];
  const mediaStore = new Map<string, MediaAsset>();
  const audit: AuditLogEntry[] = [];
  const devices = new Set<string>();
  const preferences = new Map<string, NotificationPreferences>();
  const stations = MOCK_STATIONS.map((s) => ({ ...s }));
  const alerts: Alert[] = buildInitialAlerts();
  /** État des alertes par utilisateur, comme des notifications : lue, retirée de sa liste. */
  const receipts = new Map<string, Map<string, { read: boolean; dismissed: boolean }>>();
  const receiptsOf = (userId: string) => {
    if (!receipts.has(userId)) receipts.set(userId, new Map());
    return receipts.get(userId)!;
  };
  const ALERT_HISTORY_DAYS = 30;

  /* ─── Helpers ─── */
  const currentHour = () => new Date(Math.floor(now().getTime() / HOUR) * HOUR - 5 * 60_000);
  const snapshotOf = (s: (typeof stations)[number], at = currentHour()) =>
    s.status === 'offline'
      ? { ...simulateSnapshot(s.id, s.baseAqi, new Date(at.getTime() - 6 * HOUR), now()) }
      : simulateSnapshot(s.id, s.baseAqi, at, now());
  const toStation = (s: (typeof stations)[number], includeLatest: boolean): Station => {
    const { baseAqi: _base, ...station } = s;
    const latest = snapshotOf(s);
    return { ...station, lastObservedAt: latest.observedAt, ...(includeLatest ? { latest } : {}) };
  };
  const findStation = (stationId: string) => {
    const s = stations.find((st) => st.id === stationId);
    if (!s) throw new ApiError('not_found', { status: 404 });
    return s;
  };

  function buildInitialAlerts(): Alert[] {
    const out: Alert[] = [];
    let n = 1;
    for (const s of MOCK_STATIONS) {
      for (const hoursAgo of [0, 26, 50]) {
        const at = new Date(Math.floor(now().getTime() / HOUR) * HOUR - hoursAgo * HOUR);
        const snap = simulateSnapshot(s.id, s.baseAqi, at, now());
        if (!snap.level || !isAtLeast(snap.level, 'unhealthy_sensitive') || !snap.dominantPollutant) continue;
        const pollutant = snap.dominantPollutant;
        const measure = snap.measures.find((m) => m.code === pollutant);
        const threshold = thresholds.find((t) => t.pollutant === pollutant && t.reference === 'WHO_2021');
        const resolved = hoursAgo > 0;
        out.push({
          id: `alr-${n++}`,
          origin: 'sensor',
          severity: snap.level,
          status: resolved ? 'resolved' : 'active',
          pollutant,
          value: measure?.value ?? 0,
          unit: POLLUTANTS[pollutant].unit,
          threshold: threshold?.value ?? 0,
          reference: 'WHO_2021',
          stationId: s.id,
          stationName: s.shortName,
          zoneId: s.zoneId,
          zoneName: s.zoneName,
          title: `${POLLUTANTS[pollutant].formula} au-dessus du seuil OMS à ${s.shortName}`,
          message: `La concentration de ${POLLUTANTS[pollutant].name.toLowerCase()} dépasse la valeur guide OMS sur la zone ${s.zoneName}.`,
          recommendations: guidance.find((g) => g.profile === 'general' && g.level === snap.level)?.actions ?? [],
          startedAt: at.toISOString(),
          acknowledgedAt: null,
          resolvedAt: resolved ? new Date(at.getTime() + 3 * HOUR).toISOString() : null,
          incidentNote: null,
          handledBy: null,
        });
      }
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async function currentUser(): Promise<User> {
    const token = await config.getAccessToken?.();
    const id = userIdFrom(token, 'mock-access.');
    const user = id ? users.find((u) => u.id === id && u.status === 'active') : undefined;
    if (!user) throw new ApiError('unauthorized', { status: 401 });
    return user;
  }

  async function requirePermission(permission: Permission): Promise<User> {
    const user = await currentUser();
    if (!hasPermission(user, permission)) throw new ApiError('forbidden', { status: 403 });
    return user;
  }

  const toMe = (user: User): Me => ({ ...user, permissions: [...ROLE_PERMISSIONS[user.role]] });

  const sessionFor = (user: User): Session => {
    user.lastLoginAt = now().toISOString();
    return {
      accessToken: tokenFor(user.id),
      accessTokenExpiresAt: new Date(now().getTime() + 15 * 60_000).toISOString(),
      refreshToken: refreshFor(user.id),
      user: toMe(user),
    };
  };

  function log(actor: User, action: string, resource: string, resourceId: string | null, changes: AuditLogEntry['changes'] = null) {
    audit.unshift({
      id: `aud-${audit.length + 1}`,
      at: now().toISOString(),
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      resource,
      resourceId,
      changes,
      ip: '127.0.0.1',
    });
  }

  /** Comme l'API : seules les alertes des 30 derniers jours sont listées (sauf en administration). */
  function recentAlerts(list: Alert[]): Alert[] {
    const cutoff = now().getTime() - ALERT_HISTORY_DAYS * 24 * HOUR;
    return list.filter((a) => Date.parse(a.startedAt) >= cutoff);
  }

  function findAlert(alertId: string): Alert {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) throw new ApiError('not_found', { status: 404 });
    return alert;
  }

  function filterAlerts(q: AlertQuery = {}): Alert[] {
    return alerts.filter(
      (a) =>
        (!q.status?.length || q.status.includes(a.status)) &&
        (!q.severity?.length || q.severity.includes(a.severity)) &&
        (!q.pollutant?.length || q.pollutant.includes(a.pollutant)) &&
        (!q.zoneId || a.zoneId === q.zoneId) &&
        (!q.from || a.startedAt >= q.from) &&
        (!q.to || a.startedAt <= q.to),
    );
  }

  function history(baseAqi: number, seedId: string, q: HistoryQuery): HistoryPoint[] {
    const step = q.granularity === 'day' ? 24 * HOUR : HOUR;
    const from = Date.parse(q.from);
    const to = Math.min(Date.parse(q.to), now().getTime());
    const points: HistoryPoint[] = [];
    for (let t = Math.ceil(from / step) * step; t <= to && points.length < 800; t += step) {
      const snap = simulateSnapshot(seedId, baseAqi, new Date(t), now());
      const values: HistoryPoint['values'] = {};
      for (const m of snap.measures) if (!q.pollutants?.length || q.pollutants.includes(m.code)) values[m.code] = m.value;
      points.push({ at: new Date(t).toISOString(), aqi: snap.aqi, values });
    }
    return points;
  }

  function cityAqi(): { aqi: number | null; dominant: PollutantCode | null; worst: Station | null } {
    let worst: (typeof stations)[number] | null = null;
    let best: ReturnType<typeof snapshotOf> | null = null;
    for (const s of stations.filter((st) => st.status !== 'offline')) {
      const snap = snapshotOf(s);
      if (snap.aqi != null && (!best || snap.aqi > (best.aqi ?? -1))) {
        best = snap;
        worst = s;
      }
    }
    return { aqi: best?.aqi ?? null, dominant: best?.dominantPollutant ?? null, worst: worst ? toStation(worst, false) : null };
  }

  function buildForecasts(baseAqi: number, seedId: string, horizons: readonly ForecastHorizon[]): Forecast[] {
    const nowMs = now().getTime();
    const current = simulateSnapshot(seedId, baseAqi, currentHour(), now()).aqi ?? baseAqi;
    return horizons.map((horizon, index) => {
      const hours = horizon.endsWith('h') ? Number(horizon[0]) : Number(horizon[0]) * 24;
      const validAt = new Date(nowMs + hours * HOUR);
      const daily = !horizon.endsWith('h');
      const factor = daily ? 0.95 + noise(seedId, 'day', hours) * 0.12 : diurnalFactor(validAt.getHours()) / diurnalFactor(new Date(nowMs).getHours());
      const aqi = Math.max(5, Math.round(current * factor + noise(seedId, 'fc', hours) * 6));
      const spread = Math.round(5 + index * 4);
      const drivers = [
        daily ? 'Vent de nord-est (harmattan) modéré' : validAt.getHours() >= 17 && validAt.getHours() <= 20 ? 'Heure de pointe du trafic' : 'Cycle journalier de la circulation',
        aqi > current ? 'Faible dispersion atmosphérique' : 'Dispersion favorable',
      ];
      return {
        horizon,
        validAt: validAt.toISOString(),
        aqi,
        level: getAqiLevel(aqi)?.id ?? null,
        dominantPollutant: 'pm25',
        values: { pm25: Math.round((aqi * 15) / 10) / 10 },
        confidence: Math.round((0.92 - index * 0.07) * 100) / 100,
        interval: { low: Math.max(0, aqi - spread), high: aqi + spread },
        trend: aqi > current + 5 ? 'up' : aqi < current - 5 ? 'down' : 'stable',
        drivers,
      };
    });
  }

  function defaultPreferences(user: User): NotificationPreferences {
    return {
      pushEnabled: true,
      emailEnabled: false,
      zoneIds: user.zoneIds,
      minLevel: 'unhealthy_sensitive',
      pollutants: [...POLLUTANT_CODES],
      quietHours: { start: '22:00', end: '06:30' },
    };
  }

  function articleFromInput(input: ArticleInput, author: User, existing?: Article): Article {
    const timestamp = now().toISOString();
    const slug = input.slug?.trim() || slugify(input.title);
    if (articles.some((a) => a.slug === slug && a.id !== existing?.id)) {
      throw new ApiError('validation', { status: 422, body: { code: 'slug_taken', message: 'slug', details: { fields: { slug: 'Ce lien est déjà utilisé.' } } } });
    }
    const { mediaIds, ...fields } = input;
    const media = mediaIds
      .map((mediaId) => mediaStore.get(mediaId) ?? existing?.media.find((item) => item.id === mediaId))
      .filter((item): item is MediaAsset => item != null);
    return {
      ...fields,
      id: existing?.id ?? `art-${articles.length + 1}-${Date.now().toString(36)}`,
      slug,
      media,
      coverImageUrl: fields.coverImageUrl ?? media.find((item) => item.kind === 'image')?.url ?? null,
      author: existing?.author ?? { id: author.id, name: author.fullName, role: author.role },
      publishedAt: input.status === 'published' ? (existing?.publishedAt ?? timestamp) : null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  /* ─── Fichiers téléchargeables (rapports, exports) ─── */
  const day = (iso: string) => iso.slice(0, 10);
  const PERIOD_TITLES: Record<Report['period'], string> = { weekly: 'hebdomadaire', monthly: 'mensuel', custom: 'personnalisé' };

  function stationStats(from: string, to: string) {
    const granularity = Date.parse(to) - Date.parse(from) > 31 * 24 * HOUR ? ('day' as const) : ('hour' as const);
    return stations.map((s) => {
      const points = history(s.baseAqi, s.id, { from, to, granularity });
      const aqis = points.map((p) => p.aqi).filter((v): v is number => v != null);
      const mean = aqis.length ? Math.round(aqis.reduce((sum, v) => sum + v, 0) / aqis.length) : null;
      const max = aqis.length ? Math.max(...aqis) : null;
      const above = granularity === 'hour' ? aqis.filter((v) => v > 100).length : null;
      const alertCount = alerts.filter((a) => a.stationId === s.id && a.startedAt >= from && a.startedAt <= to).length;
      return { station: s, mean, max, above, alertCount };
    });
  }

  function buildReport(request: ReportRequest, requestedBy: string): Report {
    const stats = stationStats(request.from, request.to);
    const fileName = `senair-rapport-${request.period}-${day(request.from)}-au-${day(request.to)}.${request.format}`;
    const generatedAt = now().toISOString();
    let content: string | Uint8Array;
    if (request.format === 'csv') {
      content = toCsv(
        ['station_id', 'station', 'quartier', 'iqa_moyen', 'iqa_max', 'niveau_moyen', 'heures_iqa_superieur_100', 'alertes'],
        stats.map(({ station, mean, max, above, alertCount }) => [station.id, station.name, station.zoneName, mean, max, getAqiLevel(mean)?.label, above, alertCount]),
      );
    } else if (request.format === 'json') {
      content = JSON.stringify(
        {
          rapport: PERIOD_TITLES[request.period],
          periode: { du: request.from, au: request.to },
          genereLe: generatedAt,
          provenance: 'Données de démonstration (valeurs simulées)',
          stations: stats.map(({ station, mean, max, above, alertCount }) => ({
            id: station.id,
            nom: station.name,
            quartier: station.zoneName,
            iqaMoyen: mean,
            iqaMax: max,
            heuresIqaSuperieur100: above,
            alertes: alertCount,
          })),
        },
        null,
        2,
      );
    } else {
      const worst = [...stats].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
      const city = stats.map((s) => s.mean).filter((v): v is number => v != null);
      const cityMean = city.length ? Math.round(city.reduce((sum, v) => sum + v, 0) / city.length) : null;
      const lines: PdfLine[] = [
        { text: 'SEN-AIR : qualité de l’air à Thiès', size: 10 },
        { text: `Rapport ${PERIOD_TITLES[request.period]}`, size: 20, bold: true, gapBefore: 6 },
        { text: `Période du ${day(request.from)} au ${day(request.to)}, généré le ${day(generatedAt)}.`, size: 11, gapBefore: 4 },
        { text: 'Données de démonstration : valeurs simulées, à ne pas utiliser pour une décision sanitaire.', size: 9 },
        { text: 'Synthèse', size: 14, bold: true, gapBefore: 14 },
        { text: `IQA moyen des stations : ${cityMean ?? 'N/D'} (${getAqiLevel(cityMean)?.label ?? 'N/D'}).`, gapBefore: 2 },
        { text: `Station la plus exposée : ${worst?.station.name ?? 'N/D'}, IQA moyen ${worst?.mean ?? 'N/D'}.` },
        { text: `Alertes sur la période : ${alerts.filter((a) => a.startedAt >= request.from && a.startedAt <= request.to).length}.` },
        { text: 'Détail par station', size: 14, bold: true, gapBefore: 14 },
        ...stats.map(({ station, mean, max, alertCount }) => ({
          text: `${station.name} (${station.zoneName}) : IQA moyen ${mean ?? 'N/D'}, maximum ${max ?? 'N/D'}, ${getAqiLevel(mean)?.label ?? 'N/D'}, ${alertCount} alerte(s).`,
          size: 10,
          gapBefore: 2,
        })),
        { text: 'Échelle IQA', size: 14, bold: true, gapBefore: 14 },
        ...Object.values(AQI_LEVELS).map((level) => ({
          text: `${level.min} à ${Number.isFinite(level.max) ? level.max : '500 et plus'} : ${level.label}. ${level.healthImpact}`,
          size: 10,
        })),
      ];
      content = toPdf(lines);
    }
    return {
      id: `rep-${reports.length + 1}`,
      ...request,
      status: 'ready',
      downloadUrl: toDownloadUrl(content, request.format),
      fileName,
      generatedAt,
      requestedBy,
    };
  }

  function buildExport(q: ExportQuery): DownloadLink {
    const fileName = `senair-${q.dataset}-${day(q.from)}-au-${day(q.to)}.${q.format}`;
    const expiresAt = new Date(now().getTime() + 10 * 60_000).toISOString();
    const selected = stations.filter((s) => !q.stationIds?.length || q.stationIds.includes(s.id));
    let header: string[] = [];
    let rows: (string | number | null)[][] = [];
    if (q.dataset === 'readings') {
      const codes = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'co2', 'tvoc', 'no', 'nh3'] as const;
      const granularity = Date.parse(q.to) - Date.parse(q.from) > 31 * 24 * HOUR ? ('day' as const) : ('hour' as const);
      header = ['location_id', 'location_name', 'latitude', 'longitude', 'timestamp', ...codes, 'iqa', 'categorie_iqa'];
      rows = selected.flatMap((s) =>
        history(s.baseAqi, s.id, { from: q.from, to: q.to, granularity }).map((p) => [
          s.externalId ?? s.id,
          s.name,
          s.location.latitude,
          s.location.longitude,
          p.at,
          ...codes.map((code) => p.values[code] ?? null),
          p.aqi,
          getAqiLevel(p.aqi)?.label ?? null,
        ]),
      );
    } else if (q.dataset === 'alerts') {
      header = ['id', 'debut', 'fin', 'statut', 'niveau', 'polluant', 'valeur', 'unite', 'seuil', 'referentiel', 'station', 'quartier'];
      rows = alerts
        .filter((a) => a.startedAt >= q.from && a.startedAt <= q.to && (!q.stationIds?.length || (a.stationId && q.stationIds.includes(a.stationId))))
        .map((a) => [a.id, a.startedAt, a.resolvedAt, a.status, AQI_LEVELS[a.severity].label, a.pollutant, a.value, a.unit, a.threshold, a.reference, a.stationName, a.zoneName]);
    } else {
      header = ['station_id', 'station', 'horizon', 'valide_a', 'iqa', 'niveau', 'confiance', 'intervalle_bas', 'intervalle_haut'];
      rows = selected.flatMap((s) =>
        buildForecasts(s.baseAqi, s.id, FORECAST_HORIZONS).map((f) => [s.id, s.name, f.horizon, f.validAt, f.aqi, getAqiLevel(f.aqi)?.label ?? null, f.confidence, f.interval?.low ?? null, f.interval?.high ?? null]),
      );
    }
    const content =
      q.format === 'csv'
        ? toCsv(header, rows)
        : JSON.stringify(
            { dataset: q.dataset, du: q.from, au: q.to, provenance: 'Données de démonstration', lignes: rows.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? null]))) },
            null,
            2,
          );
    return { downloadUrl: toDownloadUrl(content, q.format), fileName, expiresAt };
  }

  // Deux rapports déjà prêts pour la démonstration.
  {
    const end = new Date(Math.floor(now().getTime() / (24 * HOUR)) * 24 * HOUR);
    reports.push(buildReport({ period: 'weekly', from: new Date(end.getTime() - 7 * 24 * HOUR).toISOString(), to: end.toISOString(), format: 'pdf' }, 'admin@senair.sn'));
    reports.push(buildReport({ period: 'monthly', from: new Date(end.getTime() - 30 * 24 * HOUR).toISOString(), to: end.toISOString(), format: 'csv' }, 'autorite@senair.sn'));
  }

  /* ─── Ports ─── */
  return {
    isMock: true,

    reference: {
      metadata: () =>
        delay(() => ({
          apiVersion: 'mock-1',
          dataUpdatedAt: currentHour().toISOString(),
          models: models.filter((m) => m.status === 'active').map(({ name, task, version }) => ({ name, task, version })),
          references: ['WHO_2021', 'NS_05_062'],
        })),
      zones: () => delay(MOCK_ZONES),
      thresholds: () => delay(() => thresholds.filter((t) => t.enabled)),
      healthGuidance: (q) =>
        delay(() => guidance.filter((g) => (!q.profile || g.profile === q.profile) && (!q.level || g.level === q.level))),
    },

    stations: {
      list: (q = {}) =>
        delay(() =>
          stations
            .filter((s) => (!q.zoneId || s.zoneId === q.zoneId) && (!q.type || s.type === q.type))
            .map((s) => toStation(s, q.includeLatest ?? false)),
        ),
      get: (stationId) => delay(() => toStation(findStation(stationId), true)),
      latest: (stationId) => delay(() => snapshotOf(findStation(stationId))),
      history: (stationId, q) =>
        delay(() => {
          const s = findStation(stationId);
          return { scope: 'station' as const, scopeId: s.id, granularity: q.granularity ?? 'hour', from: q.from, to: q.to, points: history(s.baseAqi, s.id, q) };
        }),
    },

    airQuality: {
      summary: (q = {}) =>
        delay(() => {
          const scoped = q.zoneId ? stations.filter((s) => s.zoneId === q.zoneId) : stations;
          if (q.zoneId && scoped.length === 0) throw new ApiError('not_found', { status: 404 });
          const reporting = scoped.filter((s) => s.status === 'online');
          const snaps = reporting.map((s) => ({ s, snap: snapshotOf(s) }));
          const top = snaps.reduce<(typeof snaps)[number] | null>((best, cur) => ((cur.snap.aqi ?? -1) > (best?.snap.aqi ?? -1) ? cur : best), null);
          const aqi = top?.snap.aqi ?? null;
          const yesterday = top ? simulateSnapshot(top.s.id, top.s.baseAqi, new Date(currentHour().getTime() - 24 * HOUR), now()).aqi : null;
          const lastWeek = top ? simulateSnapshot(top.s.id, top.s.baseAqi, new Date(currentHour().getTime() - 7 * 24 * HOUR), now()).aqi : null;
          return {
            scope: q.zoneId ? ('zone' as const) : ('city' as const),
            scopeId: q.zoneId ?? 'thies',
            name: q.zoneId ? (scoped[0]?.zoneName ?? q.zoneId) : 'Thiès',
            aqi,
            level: getAqiLevel(aqi)?.id ?? null,
            dominantPollutant: top?.snap.dominantPollutant ?? null,
            measures: top?.snap.measures ?? [],
            weather: top?.snap.weather ?? null,
            observedAt: top?.snap.observedAt ?? null,
            status: 'mock' as const,
            freshness: top?.snap.freshness ?? 'unknown',
            stationsReporting: reporting.length,
            stationsTotal: scoped.length,
            comparison: {
              vsYesterday: aqi != null && yesterday != null ? aqi - yesterday : null,
              vsLastWeek: aqi != null && lastWeek != null ? aqi - lastWeek : null,
            },
            worstZones: snaps
              .sort((a, b) => (b.snap.aqi ?? 0) - (a.snap.aqi ?? 0))
              .slice(0, 5)
              .map(({ s, snap }) => ({ zoneId: s.zoneId, zoneName: s.zoneName, aqi: snap.aqi, level: snap.level, dominantPollutant: snap.dominantPollutant })),
          };
        }),
      atLocation: (point) =>
        delay(() => {
          const online = stations.filter((s) => s.status === 'online');
          const ranked = online.map((s) => ({ s, d: distanceM(point, s.location) })).sort((a, b) => a.d - b.d);
          const nearest = ranked[0];
          if (!nearest) throw new ApiError('not_found', { status: 404 });
          const weights = ranked.slice(0, 4).map(({ s, d }) => ({ s, w: 1 / Math.max(d, 50) ** 2 }));
          const total = weights.reduce((sum, x) => sum + x.w, 0);
          const blendedBase = weights.reduce((sum, x) => sum + x.s.baseAqi * x.w, 0) / total;
          const snap = simulateSnapshot(`${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`, blendedBase, currentHour(), now());
          return {
            ...snap,
            location: point,
            zoneId: nearest.s.zoneId,
            zoneName: nearest.s.zoneName,
            nearestStationId: nearest.s.id,
            distanceToNearestStationM: Math.round(nearest.d),
            confidence: Math.round(Math.max(0.3, 1 - nearest.d / 5000) * 100) / 100,
          };
        }),
      heatmap: (q) =>
        delay(() => {
          const resolutionM = q.resolutionM ?? 400;
          const [minLon, minLat, maxLon, maxLat] = q.bbox ?? [-16.99, 14.74, -16.88, 14.83];
          const stepLat = resolutionM / 111_000;
          const stepLon = resolutionM / (111_000 * Math.cos((14.79 * Math.PI) / 180));
          const online = stations.filter((s) => s.status === 'online');
          const snaps = online.map((s) => ({ s, snap: snapshotOf(s) }));
          const valueOf = (snap: (typeof snaps)[number]['snap']) =>
            q.layer === 'aqi' ? snap.aqi : (snap.measures.find((m) => m.code === q.layer)?.value ?? null);
          const cells = [];
          for (let lat = minLat; lat <= maxLat; lat += stepLat) {
            for (let lon = minLon; lon <= maxLon; lon += stepLon) {
              const p = { latitude: lat, longitude: lon };
              let wSum = 0;
              let vSum = 0;
              let aSum = 0;
              let nearest = Infinity;
              for (const { s, snap } of snaps) {
                const d = Math.max(distanceM(p, s.location), 80);
                nearest = Math.min(nearest, d);
                const w = 1 / d ** 2;
                wSum += w;
                vSum += w * (valueOf(snap) ?? 0);
                aSum += w * (snap.aqi ?? 0);
              }
              const aqi = Math.round(aSum / wSum);
              cells.push({
                location: p,
                value: Math.round((vSum / wSum) * 10) / 10,
                aqi,
                level: getAqiLevel(aqi)?.id ?? null,
                uncertainty: Math.round(Math.min(1, nearest / 3000) * 100) / 100,
              });
            }
          }
          return {
            layer: q.layer,
            at: q.at ?? currentHour().toISOString(),
            resolutionM,
            method: 'idw' as const,
            modelVersion: 'mock-idw',
            generatedAt: now().toISOString(),
            status: 'mock' as const,
            cells,
          };
        }),
      zoneHistory: (zoneId, q) =>
        delay(() => {
          const s = stations.find((st) => st.zoneId === zoneId);
          if (!s) throw new ApiError('not_found', { status: 404 });
          return { scope: 'zone' as const, scopeId: zoneId, granularity: q.granularity ?? 'hour', from: q.from, to: q.to, points: history(s.baseAqi, s.id, q) };
        }),
      cityHistory: (q) =>
        delay(() => {
          const series = stations.filter((s) => s.status !== 'offline').map((s) => history(s.baseAqi, s.id, q));
          const points = (series[0] ?? []).map((point, i) => {
            const atStep = series.map((serie) => serie[i]).filter((p): p is HistoryPoint => p != null);
            const aqis = atStep.map((p) => p.aqi).filter((v): v is number => v != null);
            const values: HistoryPoint['values'] = {};
            for (const code of Object.keys(point.values) as (keyof HistoryPoint['values'])[]) {
              const vs = atStep.map((p) => p.values[code]).filter((v): v is number => v != null);
              values[code] = vs.length ? Math.max(...vs) : null;
            }
            return { at: point.at, aqi: aqis.length ? Math.max(...aqis) : null, values };
          });
          return { scope: 'city' as const, scopeId: 'thies', granularity: q.granularity ?? 'hour', from: q.from, to: q.to, points };
        }),
    },

    forecasts: {
      get: (q = {}) =>
        delay(() => {
          const scope = q.scope ?? 'city';
          const station =
            scope === 'station' ? findStation(q.scopeId ?? '') : scope === 'zone' ? stations.find((s) => s.zoneId === q.scopeId) : undefined;
          if (scope !== 'city' && !station) throw new ApiError('not_found', { status: 404 });
          const base = station?.baseAqi ?? Math.max(...stations.map((s) => s.baseAqi));
          const seed = station?.id ?? 'city';
          const model = models.find((m) => m.task === 'forecast' && m.status === 'active');
          return {
            scope,
            scopeId: q.scopeId ?? 'thies',
            modelName: model?.algorithm ?? 'XGBoost',
            modelVersion: model?.version ?? 'mock',
            generatedAt: currentHour().toISOString(),
            status: 'mock' as const,
            forecasts: buildForecasts(base, seed, q.horizons?.length ? q.horizons : FORECAST_HORIZONS),
          };
        }),
    },

    alerts: {
      list: (q = {}) =>
        delay(() =>
          paginate(
            recentAlerts(filterAlerts(q)).map(({ incidentNote: _n, handledBy: _h, ...publicAlert }) => publicAlert),
            q.cursor,
            q.limit,
          ),
        ),
      get: (alertId) =>
        delay(() => {
          const alert = alerts.find((a) => a.id === alertId);
          if (!alert) throw new ApiError('not_found', { status: 404 });
          const { incidentNote: _n, handledBy: _h, ...publicAlert } = alert;
          return publicAlert;
        }),
    },

    articles: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.toLowerCase();
          const items = articles
            .filter((a) => a.status === 'published')
            .filter((a) => (!q.category || a.category === q.category) && (q.featured == null || a.featured === q.featured))
            .filter((a) => !term || a.title.toLowerCase().includes(term) || a.excerpt.toLowerCase().includes(term))
            .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
            .map(summarize);
          return paginate(items, q.cursor, q.limit);
        }),
      getBySlug: (slug) =>
        delay(() => {
          const article = articles.find((a) => a.slug === slug && a.status === 'published');
          if (!article) throw new ApiError('not_found', { status: 404 });
          return article;
        }),
    },

    auth: {
      register: (r) =>
        delay(() => {
          if (users.some((u) => u.email.toLowerCase() === r.email.toLowerCase())) {
            throw new ApiError('validation', { status: 422, body: { code: 'email_taken', message: 'email', details: { fields: { email: 'Un compte existe déjà avec cet e-mail.' } } } });
          }
          const user: User = {
            id: `usr-${users.length + 1}`,
            email: r.email,
            fullName: r.fullName,
            role: 'citizen',
            status: 'active',
            zoneIds: r.zoneIds,
            healthProfile: r.consent.healthData ? r.healthProfile : null,
            mfaEnabled: false,
            createdAt: now().toISOString(),
            lastLoginAt: null,
          };
          users.push(user);
          return sessionFor(user);
        }),
      login: (r) =>
        delay(() => {
          const user = users.find((u) => u.email.toLowerCase() === r.email.toLowerCase());
          if (!user || r.password !== MOCK_PASSWORD || user.status !== 'active') {
            throw new ApiError('unauthorized', { status: 401, body: { code: 'invalid_credentials', message: 'Identifiants invalides' } });
          }
          if (user.mfaEnabled && r.otp !== MOCK_OTP) return { mfaRequired: true as const, challengeId: `mfa.${user.id}` };
          return sessionFor(user);
        }),
      verifyMfa: ({ challengeId, otp }) =>
        delay(() => {
          const user = users.find((u) => `mfa.${u.id}` === challengeId);
          if (!user || otp !== MOCK_OTP) throw new ApiError('unauthorized', { status: 401, body: { code: 'invalid_otp', message: 'Code invalide' } });
          return sessionFor(user);
        }),
      refresh: (refreshToken) =>
        delay(() => {
          const id = userIdFrom(refreshToken, 'mock-refresh.');
          const user = id ? users.find((u) => u.id === id && u.status === 'active') : undefined;
          if (!user) throw new ApiError('unauthorized', { status: 401 });
          return sessionFor(user);
        }),
      logout: () => delay(undefined),
      forgotPassword: () => delay(undefined),
      resetPassword: () => delay(undefined),
    },

    account: {
      me: async () => toMe(await currentUser()),
      updateProfile: async (update) => {
        const user = await requirePermission('profile:manage');
        Object.assign(user, update);
        return delay(() => toMe(user));
      },
      deleteAccount: async () => {
        const user = await currentUser();
        users.splice(users.indexOf(user), 1);
        return delay(undefined);
      },
      notificationPreferences: async () => {
        const user = await requirePermission('notifications:manage');
        return delay(() => preferences.get(user.id) ?? defaultPreferences(user));
      },
      updateNotificationPreferences: async (prefs) => {
        const user = await requirePermission('notifications:manage');
        preferences.set(user.id, prefs);
        return delay(prefs);
      },
      registerDevice: async (device) => {
        await currentUser();
        devices.add(device.token);
        return delay(undefined);
      },
      unregisterDevice: async (token) => {
        await currentUser();
        devices.delete(token);
        return delay(undefined);
      },
      myAlerts: async (q = {}) => {
        const user = await currentUser();
        const prefs = preferences.get(user.id) ?? defaultPreferences(user);
        const zones = prefs.zoneIds.length ? prefs.zoneIds : user.zoneIds;
        const mine = receiptsOf(user.id);
        return delay(() =>
          paginate(
            recentAlerts(filterAlerts(q))
              .filter((a) => (!zones.length || (a.zoneId && zones.includes(a.zoneId))) && isAtLeast(a.severity, prefs.minLevel))
              .filter((a) => !mine.get(a.id)?.dismissed)
              .map(({ incidentNote: _n, handledBy: _h, ...publicAlert }) => ({ ...publicAlert, read: mine.get(publicAlert.id)?.read ?? false }))
              .filter((a) => !q.unread || !a.read),
            q.cursor,
            q.limit,
          ),
        );
      },
      markAlertRead: async (alertId) => {
        const user = await currentUser();
        findAlert(alertId);
        const mine = receiptsOf(user.id);
        mine.set(alertId, { dismissed: false, ...mine.get(alertId), read: true });
        return delay(undefined);
      },
      markAllAlertsRead: async () => {
        const user = await currentUser();
        const mine = receiptsOf(user.id);
        for (const alert of alerts) mine.set(alert.id, { dismissed: false, ...mine.get(alert.id), read: true });
        return delay(undefined);
      },
      dismissAlert: async (alertId) => {
        const user = await currentUser();
        findAlert(alertId);
        receiptsOf(user.id).set(alertId, { read: true, dismissed: true });
        return delay(undefined);
      },
    },

    admin: {
      dashboard: async () => {
        await requirePermission('admin:access');
        return delay(() => {
          const city = cityAqi();
          const day = now().getTime() - 24 * HOUR;
          const levels: AqiLevel[] = ['moderate', 'unhealthy_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'];
          return {
            generatedAt: now().toISOString(),
            cityAqi: city.aqi,
            cityLevel: getAqiLevel(city.aqi)?.id ?? null,
            maxAqi: city.aqi,
            stations: {
              total: stations.length,
              online: stations.filter((s) => s.status === 'online').length,
              offline: stations.filter((s) => s.status === 'offline').length,
              maintenance: stations.filter((s) => s.status === 'maintenance').length,
            },
            alerts: {
              active: alerts.filter((a) => a.status === 'active').length,
              acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
              last24h: alerts.filter((a) => Date.parse(a.startedAt) >= day).length,
              byLevel: levels.map((level) => ({ level, count: alerts.filter((a) => a.severity === level).length })),
            },
            articles: {
              published: articles.filter((a) => a.status === 'published').length,
              drafts: articles.filter((a) => a.status === 'draft').length,
            },
            users: { total: users.length, newLast7d: 2 },
            topZones: stations
              .map((s) => ({ s, snap: snapshotOf(s) }))
              .sort((a, b) => (b.snap.aqi ?? 0) - (a.snap.aqi ?? 0))
              .slice(0, 5)
              .map(({ s, snap }) => ({ zoneId: s.zoneId, zoneName: s.zoneName, aqi: snap.aqi, level: snap.level, dominantPollutant: snap.dominantPollutant })),
            dataSources: {
              healthy: dataSources.filter((d) => d.status === 'healthy').length,
              degraded: dataSources.filter((d) => d.status === 'degraded').length,
              down: dataSources.filter((d) => d.status === 'down').length,
            },
          };
        });
      },

      stations: async () => {
        await requirePermission('admin:access');
        return delay(() => stations.map((s) => toStation(s, true)));
      },
      createStation: async (input) => {
        const actor = await requirePermission('stations:manage');
        if (stations.some((s) => s.externalId && s.externalId === input.externalId)) {
          throw new ApiError('validation', { status: 422, body: { code: 'duplicate', message: 'externalId', details: { fields: { externalId: 'Identifiant déjà utilisé.' } } } });
        }
        const zone = MOCK_ZONES.find((z) => z.id === input.zoneId);
        const created = { ...input, id: `st-${Date.now().toString(36)}`, zoneName: zone?.name ?? input.zoneId, baseAqi: 60 };
        stations.push(created);
        log(actor, 'station.create', 'station', created.id);
        return delay(() => toStation(created, true));
      },
      updateStation: async (stationId, input) => {
        const actor = await requirePermission('stations:manage');
        const station = findStation(stationId);
        const changes = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, { from: (station as Record<string, unknown>)[k], to: v }]));
        Object.assign(station, input);
        if (input.zoneId) station.zoneName = MOCK_ZONES.find((z) => z.id === input.zoneId)?.name ?? input.zoneId;
        log(actor, 'station.update', 'station', stationId, changes);
        return delay(() => toStation(station, true));
      },

      thresholds: async () => {
        await requirePermission('admin:access');
        return delay(() => [...thresholds]);
      },
      createThreshold: async (input) => {
        const actor = await requirePermission('thresholds:manage');
        const created: Threshold = { ...input, id: `thr-${Date.now().toString(36)}`, updatedAt: now().toISOString(), updatedBy: actor.email };
        thresholds.push(created);
        log(actor, 'threshold.create', 'threshold', created.id);
        return delay(created);
      },
      updateThreshold: async (thresholdId, input) => {
        const actor = await requirePermission('thresholds:manage');
        const threshold = thresholds.find((t) => t.id === thresholdId);
        if (!threshold) throw new ApiError('not_found', { status: 404 });
        const changes = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, { from: (threshold as unknown as Record<string, unknown>)[k], to: v }]));
        Object.assign(threshold, input, { updatedAt: now().toISOString(), updatedBy: actor.email });
        log(actor, 'threshold.update', 'threshold', thresholdId, changes);
        return delay({ ...threshold });
      },
      deleteThreshold: async (thresholdId) => {
        const actor = await requirePermission('thresholds:manage');
        const index = thresholds.findIndex((t) => t.id === thresholdId);
        if (index < 0) throw new ApiError('not_found', { status: 404 });
        thresholds.splice(index, 1);
        log(actor, 'threshold.delete', 'threshold', thresholdId);
        return delay(undefined);
      },

      alerts: async (q = {}) => {
        await requirePermission('admin:access');
        return delay(() => paginate(filterAlerts(q), q.cursor, q.limit ?? 50));
      },
      updateAlert: async (alertId, update) => {
        const actor = await requirePermission('alerts:manage');
        const alert = alerts.find((a) => a.id === alertId);
        if (!alert) throw new ApiError('not_found', { status: 404 });
        const timestamp = now().toISOString();
        const from = alert.status;
        alert.status = update.status;
        alert.incidentNote = update.incidentNote ?? alert.incidentNote ?? null;
        alert.handledBy = actor.email;
        if (update.status === 'acknowledged') alert.acknowledgedAt = alert.acknowledgedAt ?? timestamp;
        if (update.status === 'resolved') alert.resolvedAt = timestamp;
        log(actor, 'alert.update', 'alert', alertId, { status: { from, to: update.status } });
        return delay({ ...alert });
      },
      createAlert: async (input) => {
        const actor = await requirePermission('alerts:manage');
        const zone = MOCK_ZONES.find((z) => z.id === input.zoneId);
        const station = input.stationId ? stations.find((s) => s.id === input.stationId && s.zoneId === input.zoneId) : undefined;
        const fields: Record<string, string> = {};
        if (!zone) fields.zoneId = 'Zone inconnue.';
        if (input.stationId && !station) fields.stationId = 'Station inconnue dans cette zone.';
        if (input.title.trim().length < 5) fields.title = '5 caractères minimum.';
        if (input.message.trim().length < 10) fields.message = '10 caractères minimum.';
        if (Object.keys(fields).length) throw new ApiError('validation', { status: 422, body: { code: 'validation_error', message: 'Données invalides', details: { fields } } });
        const threshold = thresholds.find((t) => t.enabled && t.pollutant === input.pollutant);
        const timestamp = now().toISOString();
        const alert: Alert = {
          id: `alr-${alerts.length + 1}-${Date.now()}`,
          origin: 'manual',
          severity: input.severity,
          status: 'active',
          pollutant: input.pollutant,
          value: input.value ?? threshold?.value ?? 0,
          unit: POLLUTANTS[input.pollutant].unit,
          threshold: threshold?.value ?? input.value ?? 0,
          reference: threshold?.reference ?? 'WHO_2021',
          stationId: station?.id ?? null,
          stationName: station?.shortName ?? null,
          zoneId: zone!.id,
          zoneName: zone!.name,
          title: input.title.trim(),
          message: input.message.trim(),
          recommendations: input.recommendations?.length
            ? input.recommendations
            : (guidance.find((g) => g.profile === 'general' && g.level === input.severity)?.actions ?? []),
          startedAt: timestamp,
          acknowledgedAt: null,
          resolvedAt: null,
          incidentNote: null,
          handledBy: null,
        };
        alerts.unshift(alert);
        log(actor, 'alert.create', 'alert', alert.id, { title: { from: null, to: alert.title } });
        return delay({ ...alert });
      },
      deleteAlert: async (alertId) => {
        const actor = await requirePermission('alerts:manage');
        const alert = findAlert(alertId);
        alerts.splice(alerts.indexOf(alert), 1);
        log(actor, 'alert.delete', 'alert', alertId, { title: { from: alert.title, to: null } });
        return delay(undefined);
      },

      articles: async (q = {}) => {
        await requirePermission('articles:manage');
        return delay(() =>
          paginate(
            articles
              .filter((a) => (!q.status || a.status === q.status) && (!q.category || a.category === q.category))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map(summarize),
            q.cursor,
            q.limit ?? 50,
          ),
        );
      },
      article: async (articleId) => {
        await requirePermission('articles:manage');
        return delay(() => {
          const article = articles.find((a) => a.id === articleId);
          if (!article) throw new ApiError('not_found', { status: 404 });
          return { ...article };
        });
      },
      createArticle: async (input) => {
        const actor = await requirePermission('articles:manage');
        const article = articleFromInput(input, actor);
        articles.push(article);
        log(actor, 'article.create', 'article', article.id);
        return delay(article);
      },
      updateArticle: async (articleId, input) => {
        const actor = await requirePermission('articles:manage');
        const index = articles.findIndex((a) => a.id === articleId);
        const existing = articles[index];
        if (!existing) throw new ApiError('not_found', { status: 404 });
        const updated = articleFromInput({ ...existing, mediaIds: existing.media.map((item) => item.id), ...input }, actor, existing);
        articles[index] = updated;
        log(actor, 'article.update', 'article', articleId, input.status ? { status: { from: existing.status, to: input.status } } : null);
        return delay(updated);
      },
      deleteArticle: async (articleId) => {
        const actor = await requirePermission('articles:manage');
        const index = articles.findIndex((a) => a.id === articleId);
        if (index < 0) throw new ApiError('not_found', { status: 404 });
        articles.splice(index, 1);
        log(actor, 'article.delete', 'article', articleId);
        return delay(undefined);
      },

      uploadMedia: async (file, meta) => {
        const actor = await requirePermission('articles:manage');
        const problem = validateMediaFile({ type: file.type, size: file.size });
        const kind = mediaKindOf(file.type);
        if (problem || !kind) {
          throw new ApiError('validation', { status: 422, body: { code: 'invalid_media', message: 'file', details: { fields: { file: problem ?? 'Format non pris en charge.' } } } });
        }
        const canBlob = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
        const asset: MediaAsset = {
          id: `med-${mediaStore.size + 1}-${Date.now().toString(36)}`,
          kind,
          url: canBlob ? URL.createObjectURL(file) : `blob:mock/${meta.fileName}`,
          mimeType: file.type,
          sizeBytes: file.size,
          fileName: meta.fileName,
          alt: meta.alt,
          width: null,
          height: null,
          durationSec: null,
          posterUrl: null,
          createdAt: now().toISOString(),
        };
        mediaStore.set(asset.id, asset);
        log(actor, 'media.upload', 'media', asset.id);
        return delay(asset);
      },

      dataSources: async () => {
        await requirePermission('admin:access');
        return delay(() => dataSources.map((d) => ({ ...d })));
      },
      updateDataSource: async (sourceId, update) => {
        const actor = await requirePermission('sources:manage');
        const source = dataSources.find((d) => d.id === sourceId);
        if (!source) throw new ApiError('not_found', { status: 404 });
        log(actor, 'source.update', 'data_source', sourceId, { enabled: { from: source.enabled, to: update.enabled } });
        source.enabled = update.enabled;
        source.status = update.enabled ? 'healthy' : 'disabled';
        return delay({ ...source });
      },

      models: async () => {
        await requirePermission('admin:access');
        return delay(() => models.map((m) => ({ ...m })));
      },
      updateModel: async (modelId, update) => {
        const actor = await requirePermission('models:manage');
        const model = models.find((m) => m.id === modelId);
        if (!model) throw new ApiError('not_found', { status: 404 });
        if (update.status === 'active') {
          for (const other of models) if (other.task === model.task && other.status === 'active') other.status = 'archived';
        }
        log(actor, 'model.update', 'model', modelId, { status: { from: model.status, to: update.status } });
        model.status = update.status;
        return delay({ ...model });
      },

      reports: async () => {
        await requirePermission('reports:read');
        return delay(() => [...reports]);
      },
      requestReport: async (request) => {
        const actor = await requirePermission('reports:generate');
        const report = buildReport(request, actor.email);
        reports.unshift(report);
        log(actor, 'report.request', 'report', report.id);
        return delay(report);
      },

      users: async (q = {}) => {
        await requirePermission('users:manage');
        const term = q.search?.toLowerCase();
        return delay(() =>
          paginate(
            users.filter(
              (u) =>
                (!q.role || u.role === q.role) &&
                (!q.status || u.status === q.status) &&
                (!term || u.email.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term)),
            ),
            q.cursor,
            q.limit ?? 50,
          ),
        );
      },
      inviteUser: async (invite) => {
        const actor = await requirePermission('users:manage');
        if (users.some((u) => u.email.toLowerCase() === invite.email.toLowerCase())) {
          throw new ApiError('validation', { status: 422, body: { code: 'email_taken', message: 'email', details: { fields: { email: 'Un compte existe déjà avec cet e-mail.' } } } });
        }
        const user: User = {
          id: `usr-${users.length + 1}`,
          ...invite,
          status: 'pending',
          zoneIds: [],
          healthProfile: null,
          mfaEnabled: invite.role !== 'citizen',
          createdAt: now().toISOString(),
          lastLoginAt: null,
        };
        users.push(user);
        log(actor, 'user.invite', 'user', user.id);
        return delay(user);
      },
      updateUser: async (userId, update) => {
        const actor = await requirePermission('users:manage');
        const user = users.find((u) => u.id === userId);
        if (!user) throw new ApiError('not_found', { status: 404 });
        if (user.id === actor.id && (update.role || update.status)) {
          throw new ApiError('forbidden', { status: 403, body: { code: 'self_update', message: 'Impossible de modifier son propre rôle' } });
        }
        const changes = Object.fromEntries(Object.entries(update).map(([k, v]) => [k, { from: (user as unknown as Record<string, unknown>)[k], to: v }]));
        Object.assign(user, update);
        log(actor, 'user.update', 'user', userId, changes);
        return delay({ ...user });
      },

      usage: async (q) => {
        await requirePermission('analytics:read');
        return delay(() => {
          const days = Math.max(1, Math.min(90, Math.round((Date.parse(q.to) - Date.parse(q.from)) / (24 * HOUR))));
          const daily = Array.from({ length: days }, (_, i) => {
            const day = new Date(Date.parse(q.from) + i * 24 * HOUR).toISOString().slice(0, 10);
            const sessions = Math.round(420 + noise('usage', day) * 120 + i * 3);
            return { day, sessions, activeUsers: Math.round(sessions * 0.62) };
          });
          const sessions = daily.reduce((sum, d) => sum + d.sessions, 0);
          return {
            from: q.from,
            to: q.to,
            activeUsers: Math.round(sessions * 0.18),
            sessions,
            pushSent: Math.round(sessions * 0.09),
            byPlatform: [
              { platform: 'android' as const, sessions: Math.round(sessions * 0.58) },
              { platform: 'web' as const, sessions: Math.round(sessions * 0.3) },
              { platform: 'ios' as const, sessions: Math.round(sessions * 0.12) },
            ],
            daily,
          };
        });
      },
      auditLogs: async (q = {}) => {
        await requirePermission('audit:read');
        return delay(() =>
          paginate(
            audit.filter((e) => (!q.actorId || e.actorId === q.actorId) && (!q.resource || e.resource === q.resource)),
            q.cursor,
            q.limit ?? 50,
          ),
        );
      },
      exportData: async (q) => {
        const actor = await requirePermission('data:export_raw');
        log(actor, 'data.export', q.dataset, null);
        return delay(() => buildExport(q));
      },
    },
  };
}
