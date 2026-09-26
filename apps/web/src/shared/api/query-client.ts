import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './ApiError';

/** GET retries twice on network errors and 5xx, never on 4xx; mutations never retry (doc 05 §12.1). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return false;
  return error.code === 'NETWORK_ERROR' || error.status >= 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}
