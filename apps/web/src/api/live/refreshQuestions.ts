import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { changeScope } from './changeScope';
import { cachedEntries } from './refreshForChange';

// A ticket run's end ends the questions Claude asked in it, which the tracker settles when they
// are next read; a cancel changes nothing else on the ticket, so no change event says so.
export function refreshTicketQuestions(
  queryClient: QueryClient,
  ticketId: string,
  projectId: string,
): void {
  const { ticketKeys } = changeScope({ ticketId, projectId }, cachedEntries(queryClient));
  for (const ticketKey of ticketKeys) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.ticketQuestions(ticketKey),
      exact: true,
    });
  }
}
