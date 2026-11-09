/**
 * Les libellés des énumérations viennent de @senair/core (source unique web + mobile) ;
 * ce module les ré-exporte et ajoute les utilitaires propres au web.
 */
export {
  DATA_STATUS_LABELS,
  STATION_TYPE_LABELS,
  STATION_STATUS_LABELS,
  ALERT_STATUS_LABELS,
  ARTICLE_CATEGORY_LABELS,
  ARTICLE_STATUS_LABELS,
  DATA_SOURCE_KIND_LABELS,
  DATA_SOURCE_STATUS_LABELS,
  MODEL_TASK_LABELS,
  MODEL_STATUS_LABELS,
  REPORT_PERIOD_LABELS,
  REPORT_STATUS_LABELS,
  USER_STATUS_LABELS,
  PERIOD_LABELS,
} from '@senair/core';

/** Options `<select>` à partir d'un dictionnaire de libellés. */
export function optionsOf<K extends string>(labels: Readonly<Record<K, string>>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

/** Liens externes : n'accepte que http(s), sinon `null`. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * URL de média affichable : `https:` (fichiers servis par l'API) ou `blob:` (fichier local / mode démonstration).
 * Tout autre schéma (javascript:, data:, http:) est refusé.
 */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'blob:' ? url : null;
  } catch {
    return null;
  }
}
