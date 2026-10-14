import type { QueryClient } from '@tanstack/react-query';
import type { RunEvent, RunRequestEvent } from '@tracker/shared';
import { queryKeys } from '../queryKeys';
import { changeScope } from './changeScope';
import { refreshBatches } from './refreshBatches';
import { cachedEntries } from './refreshForChange';
import { refreshLive } from './refreshLive';
import { refreshTicketQuestions } from './refreshQuestions';
import { refreshRunSteps } from './refreshRunSteps';
import { endsRun, refreshWaiting } from './refreshWaiting';

const isTicketRuns = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === 'ticket' && queryKey[2] === 'runs';

function refreshTicketRuns(queryClient: QueryClient, ticketId: string, projectId: string): void {
  const { ticketKeys } = changeScope({ ticketId, projectId }, cachedEntries(queryClient));
  // A ticket made from a chat's card may not be cached anywhere yet, so its runs can't be told
  // apart from the others shown.
  if (ticketKeys.size === 0) {
    void refreshLive(queryClient, { predicate: ({ queryKey }) => isTicketRuns(queryKey) });
    return;
  }
  for (const ticketKey of ticketKeys) {
    void refreshLive(queryClient, { queryKey: queryKeys.ticketRuns(ticketKey), exact: true });
  }
}

export const refreshRunRequests = (queryClient: QueryClient, runId: string): void =>
  void refreshLive(queryClient, { queryKey: queryKeys.runRequests(runId), exact: true });

// A chat's row, and a ticket's row and card, say whether Claude waits for the person there.
export function refreshForRunRequest(queryClient: QueryClient, event: RunRequestEvent): void {
  refreshRunRequests(queryClient, event.runId);
  if (event.chatId) void refreshLive(queryClient, { queryKey: queryKeys.allChats() });
  if (event.ticketId) refreshWaiting(queryClient, event.projectId, event.ticketId);
}

// A helper that takes or ends a run has just been seen, so its online state may have changed too.
export function refreshForRun(queryClient: QueryClient, event: RunEvent): void {
  refreshBatches(queryClient);
  if (event.ticketId) refreshTicketRuns(queryClient, event.ticketId, event.projectId);
  if (event.ticketId && endsRun(event.status)) {
    refreshWaiting(queryClient, event.projectId, event.ticketId);
    refreshTicketQuestions(queryClient, event.ticketId, event.projectId);
  }
  if (event.chatId) {
    void refreshLive(queryClient, { queryKey: queryKeys.chat(event.chatId), exact: true });
    // An answer moves its chat to the top of the list.
    void refreshLive(queryClient, { queryKey: queryKeys.allChats() });
  }
  // The helper sends a run's last steps before its end, so a missed step event is caught up here.
  void refreshRunSteps(queryClient, event.runId);
  // A run's end also ends its open requests, which the tracker settles when they are next read.
  refreshRunRequests(queryClient, event.runId);
  void refreshLive(queryClient, { queryKey: queryKeys.runners(), exact: true });
}
