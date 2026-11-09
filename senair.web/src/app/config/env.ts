import type { ApiMode } from '@senair/core';

export interface AppEnv {
  apiMode: ApiMode;
  apiBaseUrl: string;
}

export interface RawEnv {
  VITE_API_MODE?: string;
  VITE_API_BASE_URL?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

export class EnvError extends Error {
  override readonly name = 'EnvError';
}

/** Lit et valide la configuration. Mode « mock » par défaut si rien n'est défini. */
export function parseEnv(raw: RawEnv): AppEnv {
  const mode = (raw.VITE_API_MODE ?? '').trim().toLowerCase() || 'mock';
  if (mode !== 'mock' && mode !== 'rest') {
    throw new EnvError(`VITE_API_MODE invalide : « ${mode} » (attendu : mock ou rest).`);
  }
  const baseUrl = (raw.VITE_API_BASE_URL ?? '').trim() || DEFAULT_BASE_URL;
  if (mode === 'rest') {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new EnvError('VITE_API_BASE_URL doit être une URL absolue.');
    }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new EnvError('VITE_API_BASE_URL doit utiliser HTTPS hors développement local.');
    }
  }
  return { apiMode: mode, apiBaseUrl: baseUrl.replace(/\/+$/, '') };
}

export const env: AppEnv = parseEnv({
  VITE_API_MODE: import.meta.env.VITE_API_MODE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});
