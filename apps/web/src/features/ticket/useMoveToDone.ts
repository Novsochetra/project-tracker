import { findStatusByCategory, type Status, type TicketDetail } from '@tracker/shared';
import { useToast } from '../../components';
import { moveMessage } from '../project/useTicketMove';
import { useTicketUpdate } from './useTicketUpdate';

export interface MoveToDone {
  status: Status;
  move: () => void;
}

// Reviewed work waits for a person to finish it, so the ticket offers the move at hand.
export function useMoveToDone(detail: TicketDetail, onMoved: () => void): MoveToDone | null {
  const update = useTicketUpdate(detail.ticket.key);
  const { show } = useToast();
  const done = findStatusByCategory(detail.statuses, 'done');
  if (detail.status.category !== 'reviewed' || !done) return null;
  return {
    status: done,
    move: () => {
      void update({ statusId: done.id });
      show(moveMessage(detail.ticket.key, done.name));
      onMoved();
    },
  };
}
