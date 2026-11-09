import { QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError } from '@senair/core';

export function createAppQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isApiError(error) && error.kind === 'unauthorized') onUnauthorized();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        // Pas de nouvel essai sur les erreurs non transitoires (droits, validation, introuvable).
        retry: (failureCount, error) => (isApiError(error) ? error.retryable && failureCount < 2 : failureCount < 1),
      },
      mutations: { retry: false },
    },
  });
}
