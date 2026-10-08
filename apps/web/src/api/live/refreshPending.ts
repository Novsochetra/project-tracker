import type { QueryClient } from '@tanstack/react-query';

// While a live stream is closed or reconnecting, its open refreshes every open query. Reading them
// before then reads them twice, and a read made before the stream opens can miss a change.
const waiting = new WeakSet<QueryClient>();

export function setLiveRefreshPending(queryClient: QueryClient, pending: boolean): void {
  if (pending) waiting.add(queryClient);
  else waiting.delete(queryClient);
}

export const isLiveRefreshPending = (queryClient: QueryClient): boolean => waiting.has(queryClient);
