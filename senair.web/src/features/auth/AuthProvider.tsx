import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasPermission, type LoginRequest, type Me, type Permission, type RegisterRequest, type Session } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import type { SessionStore } from './session';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  /** Retourne l'utilisateur connecté, ou l'identifiant de défi si une vérification MFA est requise. */
  login(request: LoginRequest): Promise<Me | { challengeId: string }>;
  verifyMfa(challengeId: string, otp: string): Promise<Me>;
  register(request: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
  updateUser(user: Me): void;
  /** Confort d'interface uniquement : l'autorisation fait foi côté serveur. */
  can(permission: Permission): boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ session, children }: { session: SessionStore; children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);
  const user = useSyncExternalStore(session.subscribe, session.getUser, session.getUser);

  // Démarrage : tentative de refresh → session restaurée, sinon visiteur anonyme.
  useEffect(() => {
    let cancelled = false;
    const stored = session.getStoredRefreshToken();
    const attempt: Promise<Session | null> =
      api.isMock && !stored ? Promise.resolve(null) : api.auth.refresh(api.isMock ? (stored ?? undefined) : undefined);
    attempt
      .then((restored) => {
        if (restored && !cancelled) session.set(restored);
      })
      .catch(() => session.clear())
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, session]);

  const purgePrivateCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: queryKeys.account.all });
    queryClient.removeQueries({ queryKey: queryKeys.admin.all });
  }, [queryClient]);

  const login = useCallback<AuthContextValue['login']>(
    async (request) => {
      const response = await api.auth.login(request);
      if ('mfaRequired' in response) return { challengeId: response.challengeId };
      session.set(response);
      return response.user;
    },
    [api, session],
  );

  const verifyMfa = useCallback<AuthContextValue['verifyMfa']>(
    async (challengeId, otp) => {
      const next = await api.auth.verifyMfa({ challengeId, otp });
      session.set(next);
      return next.user;
    },
    [api, session],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (request) => session.set(await api.auth.register(request)),
    [api, session],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout(api.isMock ? (session.getStoredRefreshToken() ?? undefined) : undefined);
    } catch {
      /* la session locale est purgée quoi qu'il arrive */
    } finally {
      session.clear();
      purgePrivateCache();
    }
  }, [api, session, purgePrivateCache]);

  // Toute purge de session (401, expiration) vide aussi les données privées en cache.
  useEffect(() => session.subscribe(() => !session.getUser() && purgePrivateCache()), [session, purgePrivateCache]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: !bootstrapped ? 'loading' : user ? 'authenticated' : 'anonymous',
      user,
      login,
      verifyMfa,
      register,
      logout,
      updateUser: (next) => session.setUser(next),
      can: (permission) => hasPermission(user, permission),
    }),
    [bootstrapped, user, login, verifyMfa, register, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth() doit être utilisé sous <AuthProvider>.');
  return auth;
}
