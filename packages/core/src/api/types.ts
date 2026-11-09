/**
 * DTO du contrat REST `/api/v1` (voir docs/api/openapi.yaml).
 * Conventions : JSON camelCase, dates ISO-8601 UTC, valeurs absentes = `null` (jamais 0).
 */
import type { AqiLevel } from '../domain/aqi';
import type { ForecastHorizon } from '../domain/forecast';
import type { HealthProfileId } from '../domain/health';
import type { MeasureCode, PollutantCode, Unit } from '../domain/pollutants';
import type { AveragingPeriod, ReferenceStandard } from '../domain/thresholds';
import type { Freshness } from '../domain/format';
import type { MediaKind } from '../domain/media';
import type { Permission, Role } from '../auth/permissions';

export type ISODateString = string;

/** Provenance d'une valeur : mesurée, estimée (interpolation), prévue, ou démonstration. */
export type DataStatus = 'measured' | 'estimated' | 'forecast' | 'mock';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface PageQuery {
  cursor?: string;
  limit?: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/* ───────────────────────── Référentiel ───────────────────────── */

export interface Zone {
  id: string;
  name: string;
  centroid: GeoPoint;
  /** GeoJSON Polygon/MultiPolygon, optionnel pour la carte. */
  geometry?: unknown;
}

export type StationType = 'industrial' | 'residential' | 'road' | 'reference';
export type StationStatus = 'online' | 'offline' | 'maintenance';

export interface Station {
  id: string;
  /** Identifiant fournisseur (ex. location_id AirGradient). */
  externalId: string | null;
  name: string;
  shortName: string;
  zoneId: string;
  zoneName: string;
  location: GeoPoint;
  type: StationType;
  status: StationStatus;
  provider: string;
  lastObservedAt: ISODateString | null;
  /** Inclus si `include=latest`. */
  latest?: AirQualitySnapshot | null;
}

/* ───────────────────────── Mesures ───────────────────────── */

/** Origine d'une variable : capteur de la station, OpenWeatherMap (échelle ville), satellite ou modèle. */
export type MeasureSource = 'sensor' | 'openweathermap' | 'satellite' | 'model';

export interface Measure {
  code: MeasureCode;
  value: number | null;
  unit: Unit;
  source: MeasureSource;
  /** Sous-indice IQA (= concentration / valeur limite × 100), polluants IQA uniquement. */
  subIndex: number | null;
}

export interface Weather {
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  pressureHpa: number | null;
  precipitationMm: number | null;
  source: 'sensor' | 'openweathermap' | 'mock';
  observedAt: ISODateString | null;
}

export interface AirQualitySnapshot {
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
  measures: Measure[];
  weather: Weather | null;
  observedAt: ISODateString | null;
  status: DataStatus;
  freshness: Freshness;
}

export type Granularity = 'raw' | 'hour' | 'day';

export interface HistoryPoint {
  at: ISODateString;
  aqi: number | null;
  values: Partial<Record<MeasureCode, number | null>>;
}

export interface HistoryQuery {
  from: ISODateString;
  to: ISODateString;
  granularity?: Granularity;
  pollutants?: MeasureCode[];
}

export interface History {
  scope: 'station' | 'zone' | 'city';
  scopeId: string;
  granularity: Granularity;
  from: ISODateString;
  to: ISODateString;
  points: HistoryPoint[];
}

/* ───────────────────────── Synthèse / carte ───────────────────────── */

export interface ZoneRanking {
  zoneId: string;
  zoneName: string;
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
}

export interface AirQualitySummary {
  scope: 'city' | 'zone';
  scopeId: string;
  name: string;
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
  measures: Measure[];
  weather: Weather | null;
  observedAt: ISODateString | null;
  status: DataStatus;
  freshness: Freshness;
  stationsReporting: number;
  stationsTotal: number;
  /** Écart d'IQA en points. */
  comparison: { vsYesterday: number | null; vsLastWeek: number | null };
  worstZones: ZoneRanking[];
}

export interface LocationAirQuality extends AirQualitySnapshot {
  location: GeoPoint;
  zoneId: string | null;
  zoneName: string | null;
  nearestStationId: string | null;
  distanceToNearestStationM: number | null;
  /** 0..1, fourni par le modèle d'interpolation. */
  confidence: number | null;
}

export type InterpolationMethod = 'kriging' | 'idw' | 'random_forest' | 'cokriging';

export interface HeatmapCell {
  location: GeoPoint;
  value: number | null;
  aqi: number | null;
  level: AqiLevel | null;
  uncertainty: number | null;
}

export interface HeatmapQuery {
  layer: PollutantCode | 'aqi';
  at?: ISODateString;
  /** minLon,minLat,maxLon,maxLat */
  bbox?: [number, number, number, number];
  resolutionM?: number;
}

export interface Heatmap {
  layer: PollutantCode | 'aqi';
  at: ISODateString;
  resolutionM: number;
  method: InterpolationMethod;
  modelVersion: string;
  generatedAt: ISODateString;
  status: DataStatus;
  cells: HeatmapCell[];
}

/* ───────────────────────── Prévisions ───────────────────────── */

export interface Forecast {
  horizon: ForecastHorizon;
  validAt: ISODateString;
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
  values: Partial<Record<PollutantCode, number | null>>;
  /** 0..1 — confiance fournie par le modèle, jamais calculée par le front. */
  confidence: number | null;
  interval: { low: number; high: number } | null;
  trend: 'up' | 'down' | 'stable';
  /** Facteurs explicatifs (ex. SHAP) en langage clair. */
  drivers: string[];
}

export interface ForecastQuery {
  scope?: 'city' | 'zone' | 'station';
  scopeId?: string;
  horizons?: ForecastHorizon[];
}

export interface ForecastSet {
  scope: 'city' | 'zone' | 'station';
  scopeId: string;
  modelName: string;
  modelVersion: string;
  generatedAt: ISODateString;
  status: DataStatus;
  forecasts: Forecast[];
}

/* ───────────────────────── Alertes ───────────────────────── */

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
/** `sensor` : déclenchée par une mesure ; `manual` : publiée par une autorité ou un administrateur. */
export type AlertOrigin = 'sensor' | 'manual';

export interface Alert {
  id: string;
  origin: AlertOrigin;
  severity: AqiLevel;
  status: AlertStatus;
  pollutant: PollutantCode;
  value: number;
  unit: Unit;
  threshold: number;
  reference: ReferenceStandard;
  stationId: string | null;
  stationName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  title: string;
  message: string;
  recommendations: string[];
  startedAt: ISODateString;
  acknowledgedAt: ISODateString | null;
  resolvedAt: ISODateString | null;
  /** Champs réservés aux rôles admin/autorité. */
  incidentNote?: string | null;
  handledBy?: string | null;
  /** Routes /me uniquement : alerte déjà lue par l'utilisateur. */
  read?: boolean;
}

export interface AlertQuery extends PageQuery {
  status?: AlertStatus[];
  severity?: AqiLevel[];
  pollutant?: PollutantCode[];
  zoneId?: string;
  from?: ISODateString;
  to?: ISODateString;
}

/** Mes alertes : mêmes filtres, plus les non lues seulement. */
export interface MyAlertQuery extends AlertQuery {
  unread?: boolean;
}

/** Alerte publiée manuellement (zone obligatoire ; la valeur par défaut est le seuil du polluant). */
export interface AlertCreate {
  zoneId: string;
  stationId?: string | null;
  severity: Exclude<AqiLevel, 'good'>;
  pollutant: PollutantCode;
  value?: number | null;
  title: string;
  message: string;
  recommendations?: string[];
}

export interface AlertUpdate {
  status: AlertStatus;
  incidentNote?: string;
}

/* ───────────────────────── Seuils ───────────────────────── */

export interface Threshold {
  id: string;
  pollutant: PollutantCode;
  reference: ReferenceStandard;
  period: AveragingPeriod;
  value: number;
  unit: Unit;
  /** `null` = seuil global ville. */
  zoneId: string | null;
  /** Niveau d'alerte déclenché au dépassement. */
  alertLevel: AqiLevel;
  enabled: boolean;
  updatedAt: ISODateString;
  updatedBy: string | null;
}

export type ThresholdInput = Pick<
  Threshold,
  'pollutant' | 'reference' | 'period' | 'value' | 'unit' | 'zoneId' | 'alertLevel' | 'enabled'
>;

/* ───────────────────────── Santé ───────────────────────── */

export interface HealthGuidance {
  profile: HealthProfileId;
  level: AqiLevel;
  title: string;
  actions: string[];
  disclaimer: string;
}

/* ───────────────────────── Contenus ───────────────────────── */

export type ArticleCategory = 'alert' | 'info' | 'report' | 'regulation' | 'event' | 'education';
export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  /** URL de diffusion (HTTPS en production ; `blob:` en mode démonstration). */
  url: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  /** Texte alternatif (accessibilité), obligatoire pour une photo. */
  alt: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  /** Image d'aperçu d'une vidéo. */
  posterUrl: string | null;
  createdAt: ISODateString;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown. Rendu sans HTML brut côté client. */
  content: string;
  category: ArticleCategory;
  status: ArticleStatus;
  featured: boolean;
  /** Image de couverture : la première photo des médias, ou une URL HTTPS. */
  coverImageUrl: string | null;
  /** Photos et vidéos de l'article, dans l'ordre d'affichage. */
  media: MediaAsset[];
  tags: string[];
  author: { id: string | null; name: string; role: string };
  publishedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ArticleSummary = Omit<Article, 'content'>;

export interface ArticleQuery extends PageQuery {
  category?: ArticleCategory;
  featured?: boolean;
  search?: string;
  /** Admin uniquement. */
  status?: ArticleStatus;
}

export interface ArticleInput {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  category: ArticleCategory;
  status: ArticleStatus;
  featured: boolean;
  coverImageUrl: string | null;
  /** Identifiants des médias déjà envoyés (`POST /admin/media`), dans l'ordre. */
  mediaIds: string[];
  tags: string[];
}

/* ───────────────────────── Comptes ───────────────────────── */

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'active' | 'disabled' | 'pending';
  zoneIds: string[];
  healthProfile: HealthProfileId | null;
  mfaEnabled: boolean;
  createdAt: ISODateString;
  lastLoginAt: ISODateString | null;
}

export interface Me extends User {
  permissions: Permission[];
}

export interface LoginRequest {
  email: string;
  password: string;
  /** Code TOTP — obligatoire pour les rôles authority/admin. */
  otp?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  zoneIds: string[];
  healthProfile: HealthProfileId | null;
  /** Consentement explicite au traitement du profil santé et de la zone (minimisation des données). */
  consent: { terms: true; healthData: boolean };
}

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: ISODateString;
  /** Renvoyé au mobile uniquement ; le web reçoit un cookie httpOnly. */
  refreshToken?: string;
  user: Me;
}

export interface MfaChallenge {
  mfaRequired: true;
  challengeId: string;
}

export type LoginResponse = Session | MfaChallenge;

export function isMfaChallenge(response: LoginResponse): response is MfaChallenge {
  return 'mfaRequired' in response && response.mfaRequired === true;
}

export interface ProfileUpdate {
  fullName?: string;
  zoneIds?: string[];
  healthProfile?: HealthProfileId | null;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  zoneIds: string[];
  minLevel: AqiLevel;
  pollutants: PollutantCode[];
  quietHours: { start: string; end: string } | null;
}

export interface DeviceRegistration {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

/* ───────────────────────── Administration ───────────────────────── */

export interface AdminDashboard {
  generatedAt: ISODateString;
  cityAqi: number | null;
  cityLevel: AqiLevel | null;
  maxAqi: number | null;
  stations: { total: number; online: number; offline: number; maintenance: number };
  alerts: { active: number; acknowledged: number; last24h: number; byLevel: { level: AqiLevel; count: number }[] };
  articles: { published: number; drafts: number };
  users: { total: number; newLast7d: number };
  topZones: ZoneRanking[];
  dataSources: { healthy: number; degraded: number; down: number };
}

export interface StationInput {
  name: string;
  shortName: string;
  zoneId: string;
  location: GeoPoint;
  type: StationType;
  status: StationStatus;
  externalId: string | null;
  provider: string;
}

export type DataSourceKind = 'sensor_network' | 'weather_api' | 'satellite' | 'dataset';

export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  status: 'healthy' | 'degraded' | 'down' | 'disabled';
  enabled: boolean;
  lastSyncAt: ISODateString | null;
  /** Part des messages rejetés (validation IQR/z-score) sur 24 h, 0..1. */
  rejectionRate24h: number | null;
  description: string;
}

export interface AiModel {
  id: string;
  name: string;
  task: 'forecast' | 'interpolation' | 'classification';
  algorithm: string;
  version: string;
  status: 'active' | 'candidate' | 'archived';
  metrics: { r2: number | null; rmse: number | null; mae: number | null };
  trainedAt: ISODateString;
  /** Lien MLflow (lecture). */
  trackingUrl: string | null;
}

export interface Report {
  id: string;
  period: 'weekly' | 'monthly' | 'custom';
  from: ISODateString;
  to: ISODateString;
  status: 'queued' | 'running' | 'ready' | 'failed';
  format: 'pdf' | 'csv' | 'json';
  downloadUrl: string | null;
  /** Nom de fichier proposé au téléchargement. */
  fileName: string | null;
  generatedAt: ISODateString | null;
  requestedBy: string | null;
}

export interface ReportRequest {
  period: Report['period'];
  from: ISODateString;
  to: ISODateString;
  format: Report['format'];
}

export interface UserQuery extends PageQuery {
  role?: Role;
  status?: User['status'];
  search?: string;
}

export interface UserUpdate {
  role?: Role;
  status?: User['status'];
}

export interface UserInvite {
  email: string;
  fullName: string;
  role: Role;
}

export interface UsageStats {
  from: ISODateString;
  to: ISODateString;
  activeUsers: number;
  sessions: number;
  pushSent: number;
  byPlatform: { platform: 'ios' | 'android' | 'web'; sessions: number }[];
  daily: { day: string; sessions: number; activeUsers: number }[];
}

export interface AuditLogEntry {
  id: string;
  at: ISODateString;
  /** null pour une tâche planifiée ou un compte supprimé. */
  actorId: string | null;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ip: string | null;
}

export interface AuditQuery extends PageQuery {
  actorId?: string;
  resource?: string;
  from?: ISODateString;
  to?: ISODateString;
}

export interface ExportQuery {
  dataset: 'readings' | 'alerts' | 'forecasts';
  format: 'csv' | 'json';
  from: ISODateString;
  to: ISODateString;
  stationIds?: string[];
}

export interface DownloadLink {
  /** URL signée temporaire (HTTPS) ; `blob:` en mode démonstration. */
  downloadUrl: string;
  fileName: string;
  expiresAt: ISODateString;
}

export interface ApiMetadata {
  apiVersion: string;
  dataUpdatedAt: ISODateString | null;
  models: Pick<AiModel, 'name' | 'task' | 'version'>[];
  references: ReferenceStandard[];
}
