import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isNotFound, queryKeys, useApi } from '../../../api';
import { storedDraft } from '../../../lib/storedDrafts';
import { checkDraft, serverText, type DraftCheck } from './draftCheck';

// Null when nothing is kept for the draft (the user dropped it meanwhile).
export type CheckResult = DraftCheck | 'unreachable' | null;

// Compares a kept draft with what the tracker has now, refreshing the ticket on screen too.
// The cache can't be trusted for this: rolled-back optimistic saves leave old typed text in it.
export function useDraftCheck(ticketKey: string): (id: string) => Promise<CheckResult> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string) => {
      const draft = storedDraft(id);
      if (!draft) return null;
      if (navigator.onLine === false) return 'unreachable';
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: queryKeys.ticket(ticketKey),
          queryFn: () => client.getTicket(ticketKey),
          staleTime: 0,
          retry: false,
        });
        return checkDraft(draft, serverText(detail, draft));
      } catch (error) {
        return isNotFound(error) ? 'gone' : 'unreachable';
      }
    },
    [client, queryClient, ticketKey],
  );
}
