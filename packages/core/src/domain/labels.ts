/**
 * Libellés français des énumérations du contrat API — source unique pour le web et le mobile.
 */
import type {
  AiModel,
  AlertStatus,
  ArticleCategory,
  ArticleStatus,
  DataSource,
  DataSourceKind,
  DataStatus,
  MeasureSource,
  Forecast,
  Report,
  StationStatus,
  StationType,
  User,
} from '../api/types';
import type { AveragingPeriod } from './thresholds';

export const DATA_STATUS_LABELS: Readonly<Record<DataStatus, string>> = {
  measured: 'Mesuré',
  estimated: 'Estimé',
  forecast: 'Prévision',
  mock: 'Démonstration',
};

export const MEASURE_SOURCE_LABELS: Readonly<Record<MeasureSource, string>> = {
  sensor: 'Capteur de la station',
  openweathermap: 'OpenWeatherMap (ville)',
  satellite: 'Satellite',
  model: 'Modèle',
};

export const STATION_TYPE_LABELS: Readonly<Record<StationType, string>> = {
  industrial: 'Industrielle',
  residential: 'Résidentielle',
  road: 'Trafic routier',
  reference: 'Référence',
};

export const STATION_STATUS_LABELS: Readonly<Record<StationStatus, string>> = {
  online: 'En ligne',
  offline: 'Hors ligne',
  maintenance: 'Maintenance',
};

export const ALERT_STATUS_LABELS: Readonly<Record<AlertStatus, string>> = {
  active: 'En cours',
  acknowledged: 'Prise en charge',
  resolved: 'Résolue',
};

export const ARTICLE_CATEGORY_LABELS: Readonly<Record<ArticleCategory, string>> = {
  alert: 'Alerte',
  info: 'Information',
  report: 'Rapport',
  regulation: 'Réglementation',
  event: 'Événement',
  education: 'Sensibilisation',
};

export const ARTICLE_STATUS_LABELS: Readonly<Record<ArticleStatus, string>> = {
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
};

export const TREND_LABELS: Readonly<Record<Forecast['trend'], string>> = {
  up: 'En hausse',
  down: 'En baisse',
  stable: 'Stable',
};

export const DATA_SOURCE_KIND_LABELS: Readonly<Record<DataSourceKind, string>> = {
  sensor_network: 'Réseau de capteurs',
  weather_api: 'API météo',
  satellite: 'Satellite',
  dataset: 'Jeu de données',
};

export const DATA_SOURCE_STATUS_LABELS: Readonly<Record<DataSource['status'], string>> = {
  healthy: 'Opérationnelle',
  degraded: 'Dégradée',
  down: 'En panne',
  disabled: 'Désactivée',
};

export const MODEL_TASK_LABELS: Readonly<Record<AiModel['task'], string>> = {
  forecast: 'Prévision',
  interpolation: 'Interpolation spatiale',
  classification: 'Classification',
};

export const MODEL_STATUS_LABELS: Readonly<Record<AiModel['status'], string>> = {
  active: 'Actif',
  candidate: 'Candidat',
  archived: 'Archivé',
};

export const REPORT_PERIOD_LABELS: Readonly<Record<Report['period'], string>> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  custom: 'Personnalisé',
};

export const REPORT_STATUS_LABELS: Readonly<Record<Report['status'], string>> = {
  queued: 'En attente',
  running: 'En cours',
  ready: 'Prêt',
  failed: 'Échec',
};

export const USER_STATUS_LABELS: Readonly<Record<User['status'], string>> = {
  active: 'Actif',
  disabled: 'Désactivé',
  pending: 'Invitation en attente',
};

export const PERIOD_LABELS: Readonly<Record<AveragingPeriod, string>> = {
  '1h': '1 heure',
  '8h': '8 heures',
  '24h': '24 heures',
  '1y': 'Annuelle',
};
