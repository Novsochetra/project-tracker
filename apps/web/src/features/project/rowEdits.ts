import type { Status, TicketListItem } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useDeleteTicket, useUpdateTicket } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { useMoveToast, wasSaved } from './undo/useMoveToast';

export function useStatusChange(): (ticket: TicketListItem, status: Status) => void {
  const { mutateAsync } = useUpdateTicket();
  const { show } = useToast();
  const showMove = useMoveToast();
  return useCallback(
    (ticket, status) => {
      if (ticket.statusId === status.id) return;
      // mutateAsync, because callbacks passed to mutate only run for the latest call.
      const request = mutateAsync({ ticketKey: ticket.key, input: { statusId: status.id } });
      void request.catch((error: unknown) => show(errorMessage(error), { kind: 'error' }));
      flashRows([ticket.key]);
      showMove(ticket, status, wasSaved(request));
    },
    [mutateAsync, show, showMove],
  );
}

export function useRemoveTicket(): (ticket: TicketListItem) => void {
  const { mutate } = useDeleteTicket();
  const { show } = useToast();
  return useCallback(
    (ticket) => {
      mutate(
        { ticketKey: ticket.key },
        { onError: (error) => show(errorMessage(error), { kind: 'error' }) },
      );
      show(`${ticket.key} deleted`);
    },
    [mutate, show],
  );
}
