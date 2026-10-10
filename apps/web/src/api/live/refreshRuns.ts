import type { QueryClient } from '@tanstack/react-query';
import type { ChangeEvent } from '@tracker/shared';
import { queryKeys } from '../queryKeys';
import { changeScope } from './changeScope';
import { cachedEntries } from './refreshForChange';

// A helper that takes or ends a run has just been seen, so its online state may have changed too.
export function refreshRuns(queryClient: QueryClient, event: ChangeEvent): void {
  const { ticketKeys } = changeScope(event, cachedEntries(queryClient));
  for (const ticketKey of ticketKeys) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticketRuns(ticketKey), exact: true });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.runners(), exact: true });
}
