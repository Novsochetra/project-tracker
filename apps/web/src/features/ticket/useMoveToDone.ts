import { findStatusByCategory, type Status, type TicketDetail } from '@tracker/shared';
import { useStatusMove } from './useStatusMove';

export interface MoveToDone {
  status: Status;
  move: () => void;
}

// Reviewed work waits for a person to finish it, so the ticket offers the move at hand.
export function useMoveToDone(detail: TicketDetail, onMoved: () => void): MoveToDone | null {
  const moveTo = useStatusMove(detail);
  const done = findStatusByCategory(detail.statuses, 'done');
  if (detail.status.category !== 'reviewed' || !done) return null;
  return {
    status: done,
    move: () => {
      moveTo(done);
      onMoved();
    },
  };
}
