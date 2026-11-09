import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../shared/api/ApiProvider';
import { ToastProvider } from '../shared/ui/Toast';
import { AuthProvider } from '../features/auth/AuthProvider';
import { createSessionStore } from '../features/auth/session';
import { createAppApi } from './api';
import { createAppQueryClient } from './queryClient';
import { env } from './config/env';

function createAppContext() {
  // Mode mock uniquement : le refresh token simulé est persisté en sessionStorage.
  const session = createSessionStore({ persistMockRefreshToken: env.apiMode === 'mock' });
  const api = createAppApi(env, session);
  const queryClient = createAppQueryClient(() => session.clear());
  return { session, api, queryClient };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [{ session, api, queryClient }] = useState(createAppContext);
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <AuthProvider session={session}>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
