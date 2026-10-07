import type { QueryClient, QueryKey } from '@tanstack/react-query';

export interface CacheChange {
  queryKey: QueryKey;
  apply: (queryClient: QueryClient) => void;
}

export type Rollback = () => void;

export function cacheChange<T>(queryKey: QueryKey, update: (data: T) => T): CacheChange {
  return {
    queryKey,
    apply: (queryClient) => {
      queryClient.setQueryData<T>(queryKey, (data) => (data === undefined ? data : update(data)));
    },
  };
}

// Cancelling first stops an in-flight refetch from landing on top of the change.
export async function applyOptimistic(
  queryClient: QueryClient,
  changes: readonly CacheChange[],
): Promise<Rollback> {
  await Promise.all(
    changes.map(({ queryKey }) => queryClient.cancelQueries({ queryKey, exact: true })),
  );
  const previous = changes.map(({ queryKey }) => ({
    queryKey,
    data: queryClient.getQueryData(queryKey),
  }));
  for (const change of changes) change.apply(queryClient);
  return () => {
    for (const { queryKey, data } of previous) queryClient.setQueryData(queryKey, data);
  };
}

export async function patchCaches(
  queryClient: QueryClient,
  changes: readonly CacheChange[],
): Promise<void> {
  await applyOptimistic(queryClient, changes);
}

export const rollbackOnError = (_error: Error, _variables: unknown, rollback?: Rollback): void =>
  rollback?.();
