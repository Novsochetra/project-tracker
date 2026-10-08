import type { Status, TicketListItem } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useDeleteTicket, useUpdateTicket } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { moveMessage } from './useTicketMove';

/** Swipe and action-sheet status changes put the ticket at the top of its new group. */
export function useStatusChange(): (ticket: TicketListItem, status: Status) => void {
  const { mutate } = useUpdateTicket();
  const { show } = useToast();
  return useCallback(
    (ticket, status) => {
      if (ticket.statusId === status.id) return;
      mutate(
        { ticketKey: ticket.key, input: { statusId: status.id } },
        { onError: (error) => show(errorMessage(error)) },
      );
      flashRows([ticket.key]);
      show(moveMessage(ticket.key, status.name));
    },
    [mutate, show],
  );
}

export function useRemoveTicket(): (ticket: TicketListItem) => void {
  const { mutate } = useDeleteTicket();
  const { show } = useToast();
  return useCallback(
    (ticket) => {
      mutate({ ticketKey: ticket.key }, { onError: (error) => show(errorMessage(error)) });
      show(`${ticket.key} deleted`);
    },
    [mutate, show],
  );
}
