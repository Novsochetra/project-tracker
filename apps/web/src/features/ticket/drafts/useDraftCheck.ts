import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TicketDetail } from '@tracker/shared';
import { useCallback } from 'react';
import { isNotFound, queryKeys, useApi } from '../../../api';
import { storedDraft } from '../../../lib/storedDrafts';
import { checkDraft, serverText, type DraftCheck } from './draftCheck';

// Null when nothing is kept for the draft (the user dropped it meanwhile).
export type CheckResult = DraftCheck | 'unreachable' | null;

const savesTicket = (variables: unknown, ticketKey: string): boolean =>
  typeof variables === 'object' &&
  variables !== null &&
  (variables as { ticketKey?: unknown }).ticketKey === ticketKey;

// What the check found shows on screen too, so a field follows the tracker and Use theirs shows
// theirs. Not when a save for the ticket started meanwhile: its optimistic copy, and the refetch
// after it, are newer than this answer.
function showOnScreen(
  queryClient: QueryClient,
  ticketKey: string,
  detail: TicketDetail,
  since: number,
): void {
  const saving = queryClient.getMutationCache().findAll({
    predicate: ({ state }) =>
      savesTicket(state.variables, ticketKey) &&
      (state.status === 'pending' || state.submittedAt >= since),
  });
  if (saving.length === 0) queryClient.setQueryData(queryKeys.ticket(ticketKey), detail);
}

// Compares a kept draft with what the tracker has now. Neither the cache nor a saved answer can
// be trusted for this: rolled-back optimistic saves leave old typed text in the cache, and an
// answer saved before someone else's change would let the retry save over it. So the read is
// fresh: from the tracker, or a failed check that saves nothing. It is a query of its own, so
// checks running together share it and the offline banner hears how it went.
export function useDraftCheck(ticketKey: string): (id: string) => Promise<CheckResult> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string) => {
      const draft = storedDraft(id);
      if (!draft) return null;
      if (navigator.onLine === false) return 'unreachable';
      const since = Date.now();
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: ['draftCheck', ticketKey],
          queryFn: () => client.getTicket(ticketKey, { fresh: true }),
          staleTime: 0,
          gcTime: 0,
          retry: false,
        });
        showOnScreen(queryClient, ticketKey, detail, since);
        return checkDraft(draft, serverText(detail, draft));
      } catch (error) {
        return isNotFound(error) ? 'gone' : 'unreachable';
      }
    },
    [client, queryClient, ticketKey],
  );
}
