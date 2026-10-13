import type { InvalidateQueryFilters, Query, QueryClient } from '@tanstack/react-query';
import { busyKeys } from '../pending';
import { isRefreshable } from '../refresh';
import { startLiveReads } from './liveReads';

const JOIN = { cancelRefetch: false } as const;

const isReading = (query: Query): boolean => query.state.fetchStatus === 'fetching';

// A read on its way is left to land: a query with no data yet joins it anyway, which lost run
// requests (PT-217), and cancelled by each event of a burst, none landed on a slow network
// (test/regression/step-reads-starve). It may have started before the change, so the queries it
// was reading are read once more after it lands. The events of a burst join that one read too.
// An edit that started meanwhile keeps its query as the person left it until it settles. Its reads
// wait for the tracker rather than take the service worker's saved copy (liveReads.ts).
export async function refreshLive(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
): Promise<void> {
  const reading = new Set(queryClient.getQueryCache().findAll(filters).filter(isReading));
  await startLiveReads(() => queryClient.invalidateQueries(filters, JOIN));
  if (reading.size === 0) return;
  const busy = busyKeys(queryClient);
  const again = {
    ...filters,
    predicate: (query: Query) =>
      reading.has(query) && isRefreshable(queryClient, query.queryKey, busy),
  };
  await startLiveReads(() => queryClient.invalidateQueries(again, JOIN));
}
