/**
 * Règles des médias d'articles (photo ou vidéo). Le front les applique avant l'envoi ;
 * le backend les revérifie (type réel du fichier, taille, analyse antivirus).
 */
export type MediaKind = 'image' | 'video';

export const MEDIA_RULES: Readonly<Record<MediaKind, { mimeTypes: readonly string[]; maxBytes: number; label: string }>> = {
  image: { mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, label: 'Photo (JPEG, PNG ou WebP, 5 Mo maximum)' },
  video: { mimeTypes: ['video/mp4', 'video/webm'], maxBytes: 50 * 1024 * 1024, label: 'Vidéo (MP4 ou WebM, 50 Mo maximum)' },
};

export const MAX_MEDIA_PER_ARTICLE = 10;

export const ACCEPTED_MEDIA_TYPES = [...MEDIA_RULES.image.mimeTypes, ...MEDIA_RULES.video.mimeTypes].join(',');

export function mediaKindOf(mimeType: string): MediaKind | null {
  if (MEDIA_RULES.image.mimeTypes.includes(mimeType)) return 'image';
  if (MEDIA_RULES.video.mimeTypes.includes(mimeType)) return 'video';
  return null;
}

/** Retourne un message d'erreur affichable, ou `null` si le fichier est accepté. */
export function validateMediaFile(file: { type: string; size: number }): string | null {
  const kind = mediaKindOf(file.type);
  if (!kind) return 'Format non pris en charge : photo JPEG, PNG, WebP ou vidéo MP4, WebM.';
  if (file.size > MEDIA_RULES[kind].maxBytes) {
    return kind === 'image' ? 'Photo trop lourde : 5 Mo maximum.' : 'Vidéo trop lourde : 50 Mo maximum.';
  }
  if (file.size === 0) return 'Le fichier est vide.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}
