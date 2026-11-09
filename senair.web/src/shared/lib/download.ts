import { env } from '../../app/config/env';

const ALLOWED_PROTOCOLS = new Set(['https:', 'blob:', 'data:']);

/** Vérifie qu'une URL de fichier peut être téléchargée : `https:`, `blob:`, `data:`, ou `http:` venant de l'API (développement local). */
export function isDownloadableUrl(url: string | null | undefined, apiOrigin: string = new URL(env.apiBaseUrl).origin): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) || (parsed.protocol === 'http:' && parsed.origin === apiOrigin);
  } catch {
    return false;
  }
}

/** Nettoie un nom de fichier proposé par le serveur (pas de chemin, pas de caractères de contrôle). */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').trim();
  return cleaned.slice(0, 120) || 'telechargement';
}

/**
 * Déclenche le téléchargement via un lien `<a download>` temporaire cliqué par programme.
 * Retourne `false` si l'URL est refusée.
 */
export function downloadFile(url: string | null | undefined, fileName: string, doc: Document = document): boolean {
  if (!isDownloadableUrl(url)) return false;
  const link = doc.createElement('a');
  link.href = url;
  link.download = safeFileName(fileName);
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
