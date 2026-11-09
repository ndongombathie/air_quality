import type { ApiErrorBody } from './types';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

/** Messages affichables : jamais le détail technique brut du serveur. */
const USER_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Connexion impossible. Vérifiez votre réseau.',
  timeout: 'Le serveur met trop de temps à répondre.',
  unauthorized: 'Votre session a expiré. Veuillez vous reconnecter.',
  forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
  not_found: 'Élément introuvable.',
  validation: 'Certaines informations sont invalides.',
  rate_limited: 'Trop de requêtes. Réessayez dans un instant.',
  server: 'Le service est momentanément indisponible.',
  unknown: 'Une erreur inattendue est survenue.',
};

/** Codes métier renvoyés par l'API : message précis plutôt que le message générique du statut HTTP. */
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  invalid_otp: 'Code de vérification incorrect.',
  invalid_challenge: 'La vérification a expiré. Reconnectez-vous.',
  mfa_setup_required: "La double authentification n'est pas encore configurée pour ce compte. Contactez l'administrateur.",
  origin_not_allowed: 'Requête refusée pour des raisons de sécurité.',
  self_update: 'Vous ne pouvez pas modifier votre propre rôle ou statut.',
  slug_taken: 'Ce lien est déjà utilisé.',
  email_taken: 'Un compte existe déjà avec cet e-mail.',
  forecast_unavailable: 'Aucune prévision disponible pour l\'instant.',
  out_of_coverage: 'Cette position est hors de la zone couverte par SEN-AIR.',
  file_too_large: 'Fichier trop lourd.',
  invalid_media: 'Format de fichier non pris en charge.',
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(kind: ApiErrorKind, options: { status?: number | null; body?: Partial<ApiErrorBody> | null } = {}) {
    super(CODE_MESSAGES[options.body?.code ?? ''] ?? USER_MESSAGES[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.body?.code ?? null;
    this.requestId = options.body?.requestId ?? null;
    this.details = options.body?.details ?? null;
  }

  get userMessage(): string {
    return this.message;
  }

  /** Erreurs par champ au format `{ details: { fields: { email: "..." } } }`. */
  get fieldErrors(): Record<string, string> {
    const fields = this.details?.fields;
    return fields && typeof fields === 'object' ? (fields as Record<string, string>) : {};
  }

  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server' || this.kind === 'rate_limited';
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toUserMessage(error: unknown): string {
  return isApiError(error) ? error.userMessage : USER_MESSAGES.unknown;
}
