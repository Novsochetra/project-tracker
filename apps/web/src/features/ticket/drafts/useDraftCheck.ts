import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TicketDetail } from '@tracker/shared';
import { useCallback } from 'react';
import { isNotFound, queryKeys, useApi } from '../../../api';
import { rebaseDraft, storedDraft, type StoredDraft } from '../../../lib/storedDrafts';
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

// The base other tabs keep in step may not have caught up with a save that just landed elsewhere,
// so text the field knows its own text was typed over counts too, and becomes the base.
function checkWith(
  id: string,
  draft: StoredDraft,
  now: string | undefined,
  typedOver?: string,
): DraftCheck {
  const result = checkDraft(draft, now);
  if (result !== 'changed' || typedOver === undefined) return result;
  if (checkDraft({ ...draft, base: typedOver }, now) !== 'unchanged') return result;
  rebaseDraft(id, typedOver);
  return 'unchanged';
}

// Reads the ticket from the tracker and shows it. Neither the cache nor a saved answer can be
// trusted for a check: rolled-back optimistic saves leave old typed text in the cache, and an
// answer saved before someone else's change would let the retry save over it. So the read is
// fresh: from the tracker, or it fails. It is a query of its own, so checks running together share
// it and the offline banner hears how it went.
export function useFreshTicket(ticketKey: string): () => Promise<TicketDetail> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const since = Date.now();
    const detail = await queryClient.fetchQuery({
      queryKey: ['draftCheck', ticketKey],
      queryFn: () => client.getTicket(ticketKey, { fresh: true }),
      staleTime: 0,
      gcTime: 0,
      retry: false,
    });
    showOnScreen(queryClient, ticketKey, detail, since);
    return detail;
  }, [client, queryClient, ticketKey]);
}

// Compares a kept draft with what the tracker has now; a failed read saves nothing.
export function useDraftCheck(
  ticketKey: string,
): (id: string, typedOver?: string) => Promise<CheckResult> {
  const read = useFreshTicket(ticketKey);
  return useCallback(
    async (id: string, typedOver?: string) => {
      const draft = storedDraft(id);
      if (!draft) return null;
      if (navigator.onLine === false) return 'unreachable';
      try {
        return checkWith(id, draft, serverText(await read(), draft), typedOver);
      } catch (error) {
        return isNotFound(error) ? 'gone' : 'unreachable';
      }
    },
    [read],
  );
}
