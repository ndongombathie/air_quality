import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SenairApi } from '@senair/core';
import { createSessionManager, type SessionManager, type SessionSnapshot } from '@/shared/session/sessionManager';
import { createAppApi } from './createAppApi';
import { createQueryClient } from './queryClient';

interface AppServices {
  api: SenairApi;
  session: SessionManager;
}

const ServicesContext = createContext<AppServices | null>(null);

function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('AppProviders manquant dans l’arbre de composants');
  return services;
}

/** Accès unique au client SEN-AIR pour les hooks des features. */
export function useApi(): SenairApi {
  return useServices().api;
}

export function useSessionManager(): SessionManager {
  return useServices().session;
}

export function useSession(): SessionSnapshot {
  const { session } = useServices();
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

/** QueryClient + client API + session (restaurée une fois au montage). */
export function AppProviders({ children }: { children: ReactNode }) {
  const [services] = useState<AppServices>(() => {
    const session = createSessionManager();
    return { session, api: createAppApi(session) };
  });
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    void services.session.restore();
  }, [services]);

  // Changement d'utilisateur : on vide le cache des données personnelles.
  useEffect(
    () =>
      services.session.subscribe(() => {
        if (services.session.getSnapshot().status === 'anonymous') {
          queryClient.removeQueries({ queryKey: ['account'] });
        }
      }),
    [services, queryClient],
  );

  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
}
