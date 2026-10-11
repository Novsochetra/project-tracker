import type { QueryClient } from '@tanstack/react-query';
import { ACTIVE_RUN_STATUSES, type RunStatus } from '@tracker/shared';
import { busyKeys } from '../pending';
import { queryKeys } from '../queryKeys';
import { isRefreshable } from '../refresh';
import { changeScope } from './changeScope';
import { cachedEntries } from './refreshForChange';

// Only a running run asks, so only its end, not its start, can end the wait.
export const endsRun = (status: RunStatus): boolean =>
  !ACTIVE_RUN_STATUSES.some((active) => active === status);

// A move or edit in flight keeps the board as the person left it, and the last one to settle
// reads it again.
export function refreshWaiting(queryClient: QueryClient, projectId: string, ticketId: string) {
  const { projectKeys } = changeScope({ projectId, ticketId }, cachedEntries(queryClient));
  const busy = busyKeys(queryClient);
  for (const projectKey of projectKeys) {
    const queryKey = queryKeys.board(projectKey);
    if (!isRefreshable(queryClient, queryKey, busy)) continue;
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }
}
