import { QueryClient } from '@tanstack/react-query';
import { isClientError } from './errors';

export const STALE_TIME_MS = 30_000;

// 4xx answers (401, 404, validation) won't change on a second try, so only retry the rest once.
export const retryOnce = (failureCount: number, error: unknown): boolean =>
  failureCount < 1 && !isClientError(error);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // The service worker answers GET /api from its cache while offline, so queries keep running.
      queries: {
        staleTime: STALE_TIME_MS,
        retry: retryOnce,
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      // Writes aren't cached; trying right away fails fast with a clear message instead of pausing.
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
}
