import type { ArticleSummary, MediaAsset } from '@senair/core';

/**
 * Sources de médias acceptées :
 * - `https:` toujours ;
 * - `http:` seulement depuis l'origine de l'API (serveur de développement local, déjà de confiance) ;
 * - `blob:` et `file:` uniquement en démonstration (médias créés localement par le mode mock).
 * Tout autre schéma est refusé.
 */
export interface MediaTrust {
  allowLocal: boolean;
  /** Origine de l'API, par exemple `http://192.168.1.87:8000`. */
  apiOrigin: string | null;
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isSafeMediaUrl(url: string | null | undefined, trust: MediaTrust): url is string {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') return trust.apiOrigin !== null && parsed.origin === trust.apiOrigin;
  return trust.allowLocal && (parsed.protocol === 'blob:' || parsed.protocol === 'file:');
}

export function safeMedia(media: readonly MediaAsset[] | undefined, trust: MediaTrust): MediaAsset[] {
  return (media ?? []).filter((m) => isSafeMediaUrl(m.url, trust));
}

/** Image de couverture affichable : `coverImageUrl`, sinon première photo sûre. */
export function coverOf(article: Pick<ArticleSummary, 'coverImageUrl' | 'media'>, trust: MediaTrust): { url: string; alt: string } | null {
  const photo = safeMedia(article.media, trust).find((m) => m.kind === 'image');
  if (isSafeMediaUrl(article.coverImageUrl, trust)) return { url: article.coverImageUrl, alt: photo?.alt ?? '' };
  return photo ? { url: photo.url, alt: photo.alt } : null;
}

/** Ce qui illustre l'article : sa photo de couverture, sinon sa première vidéo, sinon rien. */
export type ArticleVisual = { kind: 'image'; url: string; alt: string } | { kind: 'video'; video: MediaAsset } | null;

export function visualOf(article: Pick<ArticleSummary, 'coverImageUrl' | 'media'>, trust: MediaTrust): ArticleVisual {
  const cover = coverOf(article, trust);
  if (cover) return { kind: 'image', ...cover };
  const video = safeMedia(article.media, trust).find((m) => m.kind === 'video');
  return video ? { kind: 'video', video } : null;
}

export function hasVideo(article: Pick<ArticleSummary, 'media'>): boolean {
  return (article.media ?? []).some((m) => m.kind === 'video');
}

/** Temps de lecture estimé (200 mots par minute, au moins 1 minute). */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
