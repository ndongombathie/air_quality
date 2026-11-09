/**
 * Gestionnaire de session (hors React) partagé entre le client API et l'interface.
 * - jeton d'accès : mémoire uniquement ;
 * - refresh token : expo-secure-store ;
 * - au démarrage : refresh → account.me() ; échec ou 401 : purge.
 */
import type { AccountApi, AuthApi, Me, Session } from '@senair/core';
import { secureSession } from '@/services/secureSession';

export type SessionStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface SessionSnapshot {
  status: SessionStatus;
  user: Me | null;
}

export interface SessionManager {
  getAccessToken(): string | null;
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  attach(ports: { auth: AuthApi; account: AccountApi }): void;
  restore(): Promise<void>;
  signIn(session: Session): Promise<void>;
  setUser(user: Me): void;
  /** Rafraîchit le jeton d'accès (requête mono-vol). `true` si une requête peut être rejouée. */
  refresh(): Promise<boolean>;
  /** Déconnexion volontaire : révoque côté serveur (best effort) puis purge. */
  signOut(): Promise<void>;
  /** Purge locale immédiate (401 non récupérable, compte supprimé). */
  purge(): Promise<void>;
}

const ANONYMOUS: SessionSnapshot = { status: 'anonymous', user: null };

export function createSessionManager(): SessionManager {
  let accessToken: string | null = null;
  let snapshot: SessionSnapshot = { status: 'restoring', user: null };
  let ports: { auth: AuthApi; account: AccountApi } | null = null;
  let inflightRefresh: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();

  const emit = (next: SessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const requirePorts = () => {
    if (!ports) throw new Error('SessionManager non relié au client API');
    return ports;
  };

  async function applySession(session: Session): Promise<void> {
    accessToken = session.accessToken;
    if (session.refreshToken) await secureSession.setRefreshToken(session.refreshToken);
  }

  async function purge(): Promise<void> {
    accessToken = null;
    await secureSession.clear();
    emit(ANONYMOUS);
  }

  async function refresh(): Promise<boolean> {
    inflightRefresh ??= (async () => {
      try {
        const refreshToken = await secureSession.getRefreshToken();
        if (!refreshToken) return false;
        await applySession(await requirePorts().auth.refresh(refreshToken));
        return true;
      } catch {
        return false;
      } finally {
        inflightRefresh = null;
      }
    })();
    return inflightRefresh;
  }

  return {
    getAccessToken: () => accessToken,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attach(next) {
      ports = next;
    },
    async restore() {
      if (!(await refresh())) {
        await purge();
        return;
      }
      try {
        emit({ status: 'authenticated', user: await requirePorts().account.me() });
      } catch {
        await purge();
      }
    },
    async signIn(session) {
      await applySession(session);
      emit({ status: 'authenticated', user: session.user });
    },
    setUser(user) {
      if (snapshot.status === 'authenticated') emit({ status: 'authenticated', user });
    },
    refresh,
    async signOut() {
      const refreshToken = await secureSession.getRefreshToken();
      try {
        await requirePorts().auth.logout(refreshToken ?? undefined);
      } catch {
        // La purge locale suffit si le serveur est injoignable.
      }
      await purge();
    },
    purge,
  };
}
