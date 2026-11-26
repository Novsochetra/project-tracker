import type { Query, QueryClient } from '@tanstack/react-query';
import type { RunBatch } from '@tracker/shared';
import { queryKeys, rootOf } from '../queryKeys';

// An ended batch never changes again, so a long chat's old cards are not read on every event.
const isOpenBatch = ({ queryKey, state }: Query): boolean => {
  if (rootOf(queryKey) !== 'runBatch') return false;
  const status = (state.data as RunBatch | undefined)?.status;

  return status === undefined || status === 'queued' || status === 'running';
};

export function refreshBatches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.runActivity(), exact: true });
  void queryClient.invalidateQueries({ predicate: isOpenBatch });
}
