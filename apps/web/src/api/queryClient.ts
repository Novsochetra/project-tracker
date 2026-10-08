import { QueryClient } from '@tanstack/react-query';
import { setPendingWrites } from '../lib/pendingWrites';
import { isClientError } from './errors';
import { isLiveRefreshPending } from './live/refreshPending';

export const STALE_TIME_MS = 30_000;

// 4xx answers (401, 404, validation) won't change on a second try, so only retry the rest once.
export const retryOnce = (failureCount: number, error: unknown): boolean =>
  failureCount < 1 && !isClientError(error);

// The reload into a new app version waits for writes in flight, so it never cuts one off.
function reportPendingWrites(queryClient: QueryClient): void {
  queryClient.getMutationCache().subscribe(() => {
    setPendingWrites(queryClient, queryClient.isMutating() > 0);
  });
}

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      // The service worker answers GET /api from its cache while offline, so queries keep running.
      queries: {
        staleTime: STALE_TIME_MS,
        retry: retryOnce,
        // A reopening live stream reads everything once it opens, as on a return after 30 s hidden
        // or once the network is back.
        refetchOnWindowFocus: () => !isLiveRefreshPending(queryClient),
        refetchOnReconnect: () => !isLiveRefreshPending(queryClient),
        networkMode: 'offlineFirst',
      },
      // Writes aren't cached; trying right away fails fast with a clear message instead of pausing.
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
  reportPendingWrites(queryClient);
  return queryClient;
}
