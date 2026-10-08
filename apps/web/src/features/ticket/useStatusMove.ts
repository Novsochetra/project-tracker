import type { Status, TicketDetail } from '@tracker/shared';
import { useMoveToast } from '../project/undo/useMoveToast';
import { useTicketUpdate } from './useTicketUpdate';

export function useStatusMove(detail: TicketDetail): (status: Status) => void {
  const update = useTicketUpdate(detail.ticket.key);
  const showMove = useMoveToast();
  return (status) => {
    if (status.id === detail.ticket.statusId) return;
    showMove(detail.ticket, status, update({ statusId: status.id }));
  };
}
