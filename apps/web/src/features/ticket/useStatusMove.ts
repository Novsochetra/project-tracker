import type { Status, TicketDetail } from '@tracker/shared';
import { useMoveToast } from '../project/undo/useMoveToast';
import { useTicketUpdate } from './useTicketUpdate';

/** A status change on the ticket screen goes to the top of its group; the toast offers Undo. */
export function useStatusMove(detail: TicketDetail): (status: Status) => void {
  const update = useTicketUpdate(detail.ticket.key);
  const showMove = useMoveToast();
  return (status) => {
    if (status.id === detail.ticket.statusId) return;
    showMove(detail.ticket, status, update({ statusId: status.id }));
  };
}
