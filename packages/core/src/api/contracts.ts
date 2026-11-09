/**
 * Ports de l'application (inversion de dépendance) : les écrans dépendent de ces interfaces,
 * jamais d'un transport. Deux implémentations : `createRestApi` (backend Django) et `createMockApi`.
 * Interfaces séparées par domaine (ségrégation des interfaces).
 */
import type { AqiLevel } from '../domain/aqi';
import type { HealthProfileId } from '../domain/health';
import type {
  AdminDashboard,
  AiModel,
  Alert,
  AlertCreate,
  AlertQuery,
  AlertUpdate,
  MyAlertQuery,
  ApiMetadata,
  Article,
  ArticleInput,
  ArticleQuery,
  ArticleSummary,
  AirQualitySummary,
  AuditLogEntry,
  AuditQuery,
  DataSource,
  DeviceRegistration,
  DownloadLink,
  MediaAsset,
  ExportQuery,
  ForecastQuery,
  ForecastSet,
  GeoPoint,
  HealthGuidance,
  Heatmap,
  HeatmapQuery,
  History,
  HistoryQuery,
  LocationAirQuality,
  LoginRequest,
  LoginResponse,
  Me,
  NotificationPreferences,
  Page,
  ProfileUpdate,
  RegisterRequest,
  Report,
  ReportRequest,
  Session,
  Station,
  StationInput,
  AirQualitySnapshot,
  Threshold,
  ThresholdInput,
  UsageStats,
  User,
  UserInvite,
  UserQuery,
  UserUpdate,
  Zone,
} from './types';

export interface ReferenceApi {
  metadata(): Promise<ApiMetadata>;
  zones(): Promise<Zone[]>;
  thresholds(): Promise<Threshold[]>;
  healthGuidance(query: { profile?: HealthProfileId; level?: AqiLevel }): Promise<HealthGuidance[]>;
}

export interface StationsApi {
  list(query?: { zoneId?: string; type?: Station['type']; includeLatest?: boolean }): Promise<Station[]>;
  get(stationId: string): Promise<Station>;
  latest(stationId: string): Promise<AirQualitySnapshot>;
  history(stationId: string, query: HistoryQuery): Promise<History>;
}

export interface AirQualityApi {
  summary(query?: { zoneId?: string }): Promise<AirQualitySummary>;
  atLocation(point: GeoPoint): Promise<LocationAirQuality>;
  heatmap(query: HeatmapQuery): Promise<Heatmap>;
  zoneHistory(zoneId: string, query: HistoryQuery): Promise<History>;
  /** Historique agrégé de la ville (IQA ville = max des stations à chaque pas). */
  cityHistory(query: HistoryQuery): Promise<History>;
}

export interface ForecastsApi {
  get(query?: ForecastQuery): Promise<ForecastSet>;
}

export interface AlertsApi {
  list(query?: AlertQuery): Promise<Page<Alert>>;
  get(alertId: string): Promise<Alert>;
}

export interface ArticlesApi {
  list(query?: ArticleQuery): Promise<Page<ArticleSummary>>;
  getBySlug(slug: string): Promise<Article>;
}

export interface AuthApi {
  register(request: RegisterRequest): Promise<Session>;
  login(request: LoginRequest): Promise<LoginResponse>;
  verifyMfa(request: { challengeId: string; otp: string }): Promise<Session>;
  /** Mobile : envoie le refresh token ; web : cookie httpOnly. */
  refresh(refreshToken?: string): Promise<Session>;
  logout(refreshToken?: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(request: { token: string; password: string }): Promise<void>;
}

export interface AccountApi {
  me(): Promise<Me>;
  updateProfile(update: ProfileUpdate): Promise<Me>;
  deleteAccount(): Promise<void>;
  notificationPreferences(): Promise<NotificationPreferences>;
  updateNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences>;
  registerDevice(device: DeviceRegistration): Promise<void>;
  unregisterDevice(token: string): Promise<void>;
  myAlerts(query?: MyAlertQuery): Promise<Page<Alert>>;
  markAlertRead(alertId: string): Promise<void>;
  markAllAlertsRead(): Promise<void>;
  /** Retire l'alerte de mes notifications ; elle reste publique. */
  dismissAlert(alertId: string): Promise<void>;
}

export interface AdminApi {
  dashboard(): Promise<AdminDashboard>;

  stations(): Promise<Station[]>;
  createStation(input: StationInput): Promise<Station>;
  updateStation(stationId: string, input: Partial<StationInput>): Promise<Station>;

  thresholds(): Promise<Threshold[]>;
  createThreshold(input: ThresholdInput): Promise<Threshold>;
  updateThreshold(thresholdId: string, input: Partial<ThresholdInput>): Promise<Threshold>;
  deleteThreshold(thresholdId: string): Promise<void>;

  alerts(query?: AlertQuery): Promise<Page<Alert>>;
  updateAlert(alertId: string, update: AlertUpdate): Promise<Alert>;
  createAlert(input: AlertCreate): Promise<Alert>;
  deleteAlert(alertId: string): Promise<void>;

  articles(query?: ArticleQuery): Promise<Page<ArticleSummary>>;
  article(articleId: string): Promise<Article>;
  createArticle(input: ArticleInput): Promise<Article>;
  updateArticle(articleId: string, input: Partial<ArticleInput>): Promise<Article>;
  deleteArticle(articleId: string): Promise<void>;
  /** Envoi multipart d'une photo ou d'une vidéo, avant de l'associer à un article via `mediaIds`. */
  uploadMedia(file: Blob, meta: { fileName: string; alt: string }): Promise<MediaAsset>;

  dataSources(): Promise<DataSource[]>;
  updateDataSource(sourceId: string, update: { enabled: boolean }): Promise<DataSource>;

  models(): Promise<AiModel[]>;
  updateModel(modelId: string, update: { status: AiModel['status'] }): Promise<AiModel>;

  reports(): Promise<Report[]>;
  requestReport(request: ReportRequest): Promise<Report>;

  users(query?: UserQuery): Promise<Page<User>>;
  inviteUser(invite: UserInvite): Promise<User>;
  updateUser(userId: string, update: UserUpdate): Promise<User>;

  usage(query: { from: string; to: string }): Promise<UsageStats>;
  auditLogs(query?: AuditQuery): Promise<Page<AuditLogEntry>>;
  /** Retourne une URL signée temporaire de téléchargement. */
  exportData(query: ExportQuery): Promise<DownloadLink>;
}

export interface SenairApi {
  /** `true` si les données sont simulées : l'UI doit l'afficher clairement. */
  readonly isMock: boolean;
  reference: ReferenceApi;
  stations: StationsApi;
  airQuality: AirQualityApi;
  forecasts: ForecastsApi;
  alerts: AlertsApi;
  articles: ArticlesApi;
  auth: AuthApi;
  account: AccountApi;
  admin: AdminApi;
}
