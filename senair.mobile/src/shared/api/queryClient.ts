import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@senair/core';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) => failureCount < 2 && (!isApiError(error) || error.retryable),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
