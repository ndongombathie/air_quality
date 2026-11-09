import { createSenairApi, type SenairApi } from '@senair/core';
import type { AppEnv } from './config/env';
import type { SessionStore } from '../features/auth/session';

/**
 * Instancie le client SenairApi pour le navigateur.
 * Mode rest : refresh par cookie httpOnly (`credentials: 'include'`), jeton d'accès lu en mémoire.
 */
export function createAppApi(env: AppEnv, session: SessionStore): SenairApi {
  let refreshing: Promise<boolean> | null = null;

  const api: SenairApi = createSenairApi({
    mode: env.apiMode,
    baseUrl: env.apiBaseUrl,
    clientName: 'senair-web',
    credentials: 'include',
    getAccessToken: () => session.getAccessToken(),
    refreshSession: () => {
      // Un seul rafraîchissement simultané, même si plusieurs requêtes reçoivent un 401.
      refreshing ??= api.auth
        .refresh()
        .then((next) => {
          session.set(next);
          return true;
        })
        .catch(() => {
          session.clear();
          return false;
        })
        .finally(() => {
          refreshing = null;
        });
      return refreshing;
    },
    onUnauthorized: () => session.clear(),
  });
  return api;
}
