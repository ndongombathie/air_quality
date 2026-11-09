import type { Me, Session } from '@senair/core';

/**
 * Session côté navigateur.
 * - Le jeton d'accès vit UNIQUEMENT en mémoire (jamais localStorage) : un rechargement le perd.
 * - Mode rest : le refresh token est un cookie httpOnly posé par le backend, invisible du JS.
 * - Mode mock uniquement : le refresh token simulé est gardé en sessionStorage pour survivre
 *   au rechargement de l'onglet (aucune valeur réelle n'est jamais stockée ainsi).
 */
export interface SessionStore {
  getAccessToken(): string | null;
  getUser(): Me | null;
  /** Refresh token disponible côté JS : uniquement en mode mock. */
  getStoredRefreshToken(): string | null;
  set(session: Session): void;
  setUser(user: Me): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export interface SessionStoreOptions {
  persistMockRefreshToken: boolean;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

const MOCK_REFRESH_KEY = 'senair.mock.refresh';

function safeStorage(options: SessionStoreOptions) {
  if (!options.persistMockRefreshToken) return null;
  if (options.storage !== undefined) return options.storage;
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const storage = safeStorage(options);
  let accessToken: string | null = null;
  let user: Me | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    getAccessToken: () => accessToken,
    getUser: () => user,
    getStoredRefreshToken: () => {
      try {
        return storage?.getItem(MOCK_REFRESH_KEY) ?? null;
      } catch {
        return null;
      }
    },
    set(session) {
      accessToken = session.accessToken;
      user = session.user;
      try {
        // Mode mock uniquement : `storage` est null en mode rest.
        if (storage && session.refreshToken) storage.setItem(MOCK_REFRESH_KEY, session.refreshToken);
      } catch {
        /* stockage indisponible : la session ne survivra pas au rechargement */
      }
      emit();
    },
    setUser(next) {
      user = next;
      emit();
    },
    clear() {
      const hadSession = accessToken !== null || user !== null;
      accessToken = null;
      user = null;
      try {
        storage?.removeItem(MOCK_REFRESH_KEY);
      } catch {
        /* ignoré */
      }
      if (hadSession) emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
