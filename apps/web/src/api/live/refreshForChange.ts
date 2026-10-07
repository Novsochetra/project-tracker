import type { QueryClient } from '@tanstack/react-query';
import type { ChangeEvent } from '@tracker/shared';
import { busyKeys } from '../pending';
import { isRefreshable } from '../refresh';
import { changeScope, EVERYTHING, isAffected } from './changeScope';

// A null event means "anything may have changed" (a reconnect or a report that spans projects).
export function refreshForChange(
  queryClient: QueryClient,
  event: ChangeEvent | null,
  settling?: unknown,
): void {
  const entries = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
  const scope = event ? changeScope(event, entries) : EVERYTHING;
  const busy = busyKeys(queryClient, settling);
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      isAffected(queryKey, scope) && isRefreshable(queryClient, queryKey, busy),
  });
}
