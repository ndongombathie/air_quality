/**
 * Mise en forme lisible du journal d'audit : une phrase par action, des libellés en français,
 * les champs techniques (identifiants, horodatages internes) réservés au détail.
 */
import {
  ALERT_STATUS_LABELS,
  AQI_LEVELS,
  ARTICLE_CATEGORY_LABELS,
  ARTICLE_STATUS_LABELS,
  DATA_SOURCE_STATUS_LABELS,
  MODEL_STATUS_LABELS,
  PERIOD_LABELS,
  REFERENCE_LABELS,
  REPORT_PERIOD_LABELS,
  REPORT_STATUS_LABELS,
  ROLE_LABELS,
  STATION_STATUS_LABELS,
  STATION_TYPE_LABELS,
  USER_STATUS_LABELS,
  formatDateTime,
  getPollutant,
  type AuditLogEntry,
} from '@senair/core';

export type AuditTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface AuditChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

export interface FormattedAudit {
  /** « a pris en charge une alerte » : complète le nom de l'auteur. */
  sentence: string;
  /** Catégorie affichée (« Alerte », « Seuil »…). */
  resourceLabel: string;
  tone: AuditTone;
  /** Changements significatifs, pour le résumé (3 au plus). */
  highlights: AuditChange[];
  /** Tous les changements, pour le détail. */
  changes: AuditChange[];
}

/** Ressources filtrables (valeur envoyée à l'API, libellé affiché). */
export const AUDIT_RESOURCES: readonly { value: string; label: string }[] = [
  { value: 'alert', label: 'Alertes' },
  { value: 'threshold', label: 'Seuils' },
  { value: 'station', label: 'Stations' },
  { value: 'data_source', label: 'Sources de données' },
  { value: 'model', label: 'Modèles IA' },
  { value: 'article', label: 'Articles' },
  { value: 'media', label: 'Médias' },
  { value: 'report', label: 'Rapports' },
  { value: 'export', label: 'Exports' },
  { value: 'user', label: 'Utilisateurs' },
];

const RESOURCE_LABELS: Record<string, string> = {
  alert: 'Alerte',
  threshold: 'Seuil',
  station: 'Station',
  data_source: 'Source de données',
  model: 'Modèle IA',
  article: 'Article',
  media: 'Média',
  report: 'Rapport',
  export: 'Export',
  user: 'Utilisateur',
};

const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  incidentNote: "Note d'incident",
  value: 'Valeur',
  unit: 'Unité',
  pollutant: 'Polluant',
  reference: 'Référentiel',
  period: 'Période',
  periodStart: 'Du',
  periodEnd: 'Au',
  alertLevel: "Niveau d'alerte",
  zoneId: 'Quartier',
  enabled: 'Activé',
  name: 'Nom',
  shortName: 'Nom court',
  type: 'Type',
  title: 'Titre',
  category: 'Catégorie',
  featured: 'À la une',
  role: 'Rôle',
  email: 'E-mail',
  fullName: 'Nom',
  format: 'Format',
  dataset: 'Données',
  rows: 'Lignes',
  dateFrom: 'Du',
  dateTo: 'Au',
  fileName: 'Fichier',
  kind: 'Type',
  sizeBytes: 'Taille',
  alt: 'Texte alternatif',
};

/** Champs techniques : visibles seulement dans le détail. */
const TECHNICAL = /(Id|Ids|At|By)$|^(id|slug|content|excerpt|tags|mediaIds|latitude|longitude|externalId|provider|location|coverImageUrl|mimeType|signature)$/;

const DATASET_LABELS: Record<string, string> = { readings: 'Mesures', alerts: 'Alertes', forecasts: 'Prévisions' };

/** Valeur d'énumération connue vers son libellé, selon le champ. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  role: ROLE_LABELS,
  type: STATION_TYPE_LABELS,
  category: ARTICLE_CATEGORY_LABELS,
  alertLevel: Object.fromEntries(Object.values(AQI_LEVELS).map((l) => [l.id, l.label])),
  reference: REFERENCE_LABELS,
  dataset: DATASET_LABELS,
  kind: { image: 'Photo', video: 'Vidéo' },
};

const STATUS_BY_RESOURCE: Record<string, Record<string, string>> = {
  alert: ALERT_STATUS_LABELS,
  article: ARTICLE_STATUS_LABELS,
  model: MODEL_STATUS_LABELS,
  report: REPORT_STATUS_LABELS,
  station: STATION_STATUS_LABELS,
  user: USER_STATUS_LABELS,
  data_source: DATA_SOURCE_STATUS_LABELS,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatValue(field: string, value: unknown, resource: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (field === 'status') return STATUS_BY_RESOURCE[resource]?.[text] ?? text;
  if (field === 'period') return REPORT_PERIOD_LABELS[text as keyof typeof REPORT_PERIOD_LABELS] ?? PERIOD_LABELS[text as keyof typeof PERIOD_LABELS] ?? text;
  if (field === 'pollutant') return getPollutant(text)?.formula ?? text;
  if (field === 'format') return text.toUpperCase();
  if (field === 'sizeBytes' && Number.isFinite(Number(text))) return `${Math.round(Number(text) / 1024)} Ko`;
  if (VALUE_LABELS[field]?.[text]) return VALUE_LABELS[field][text]!;
  if (ISO_DATE.test(text)) return formatDateTime(text);
  return text;
}

/** Libellé connu, sinon « periodStart » devient « Period start ». */
function humanize(field: string): string {
  const words = field.replace(/([A-Z])/g, ' $1').toLowerCase();
  return FIELD_LABELS[field] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

function statusTo(entry: AuditLogEntry): string | null {
  const to = entry.changes?.status?.to;
  return typeof to === 'string' ? to : null;
}

function describe(entry: AuditLogEntry): { sentence: string; tone: AuditTone } {
  const status = statusTo(entry);
  switch (entry.action) {
    case 'alert.create':
      return { sentence: 'a publié une alerte', tone: 'success' };
    case 'alert.update':
      if (status === 'acknowledged') return { sentence: 'a pris en charge une alerte', tone: 'warning' };
      if (status === 'resolved') return { sentence: 'a résolu une alerte', tone: 'success' };
      return { sentence: 'a modifié une alerte', tone: 'info' };
    case 'alert.delete':
      return { sentence: 'a supprimé une alerte', tone: 'danger' };
    case 'threshold.create':
      return { sentence: 'a créé un seuil', tone: 'success' };
    case 'threshold.update':
      return { sentence: 'a modifié un seuil', tone: 'info' };
    case 'threshold.delete':
      return { sentence: 'a supprimé un seuil', tone: 'danger' };
    case 'station.create':
      return { sentence: 'a ajouté une station', tone: 'success' };
    case 'station.update':
      return { sentence: 'a modifié une station', tone: 'info' };
    case 'source.update': {
      const enabled = entry.changes?.enabled?.to;
      if (enabled === true) return { sentence: 'a activé une source de données', tone: 'success' };
      if (enabled === false) return { sentence: 'a désactivé une source de données', tone: 'warning' };
      return { sentence: 'a modifié une source de données', tone: 'info' };
    }
    case 'model.update':
      if (status === 'active') return { sentence: 'a activé un modèle IA', tone: 'success' };
      if (status === 'archived') return { sentence: 'a archivé un modèle IA', tone: 'neutral' };
      return { sentence: 'a modifié un modèle IA', tone: 'info' };
    case 'article.create':
      return { sentence: status === 'published' ? 'a publié un article' : 'a créé un article', tone: 'success' };
    case 'article.update':
      return { sentence: status === 'published' ? 'a publié un article' : 'a modifié un article', tone: 'info' };
    case 'article.delete':
      return { sentence: 'a supprimé un article', tone: 'danger' };
    case 'media.upload':
      return { sentence: 'a ajouté un média', tone: 'info' };
    case 'report.generate':
      return { sentence: 'a généré un rapport', tone: 'info' };
    case 'data.export':
      return { sentence: 'a exporté des données', tone: 'neutral' };
    case 'user.invite':
      return { sentence: 'a invité un utilisateur', tone: 'success' };
    case 'user.update':
      return { sentence: 'a modifié un utilisateur', tone: 'warning' };
    default:
      return { sentence: `a effectué l'action ${entry.action}`, tone: 'neutral' };
  }
}

export function formatAudit(entry: AuditLogEntry): FormattedAudit {
  const changes: AuditChange[] = Object.entries(entry.changes ?? {}).map(([field, change]) => ({
    field,
    label: humanize(field),
    from: formatValue(field, change.from, entry.resource),
    to: formatValue(field, change.to, entry.resource),
  }));
  const highlights = changes.filter((c) => !TECHNICAL.test(c.field) && (c.from !== null || c.to !== null)).slice(0, 3);
  return {
    ...describe(entry),
    resourceLabel: RESOURCE_LABELS[entry.resource] ?? entry.resource,
    highlights,
    changes,
  };
}

/** E-mail de l'auteur, ou « Compte supprimé » / « Tâche planifiée » s'il n'y en a pas. */
export function actorName(entry: AuditLogEntry): string {
  return entry.actorEmail || (entry.actorId ? 'Compte supprimé' : 'Tâche planifiée');
}

/** Jour de l'action, pour regrouper le fil : « Aujourd'hui », « Hier », ou la date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
