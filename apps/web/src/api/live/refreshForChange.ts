import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { ChangeEvent } from '@tracker/shared';
import { markChanged } from '../freshReads';
import { busyKeys } from '../pending';
import { rootOf, scopeOf } from '../queryKeys';
import { refreshProjectList } from '../projectListRefresh';
import { isRefreshable } from '../refresh';
import { changeScope, EVERYTHING, isAffected, type CachedEntry } from './changeScope';
import { refreshLive } from './refreshLive';
import { refreshBatches } from './refreshBatches';

// The service worker's copy can't hold the change that caused a refresh, so the tickets it
// refetches are read fresh.
function readFresh(queryClient: QueryClient, refreshed: readonly QueryKey[]): void {
  const tickets = new Set(refreshed.filter((key) => rootOf(key) === 'ticket').map(scopeOf));
  for (const ticketKey of tickets) if (ticketKey) markChanged(queryClient, ticketKey);
}

const isProjectList = (queryKey: QueryKey): boolean => rootOf(queryKey) === 'projects';

export const cachedEntries = (queryClient: QueryClient): CachedEntry[] =>
  queryClient
    .getQueryCache()
    .getAll()
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));

// A null event means "anything may have changed" (a reconnect or a report that spans projects).
export function refreshForChange(
  queryClient: QueryClient,
  event: ChangeEvent | null,
  settling?: unknown,
): void {
  const entries = cachedEntries(queryClient);
  const scope = event ? changeScope(event, entries) : EVERYTHING;
  const busy = busyKeys(queryClient, settling);
  const refreshed = (queryKey: QueryKey) =>
    isAffected(queryKey, scope) && isRefreshable(queryClient, queryKey, busy);
  const keys = entries.map(({ queryKey }) => queryKey).filter(refreshed);
  readFresh(queryClient, keys);
  if (!event || event.ticketId) refreshBatches(queryClient);
  if (keys.some(isProjectList)) refreshProjectList(queryClient);
  void refreshLive(queryClient, {
    predicate: ({ queryKey }) => !isProjectList(queryKey) && refreshed(queryKey),
  });
}
