import { notifyManager } from '@tanstack/react-query';
import { planMove, type DropTarget } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useMoveTicket } from '../../api';
import { announce } from '../../app/announce';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { useBoardReader } from './useBoardReader';

/** Null when nothing moves; otherwise resolves once the move is over and the board shows how. */
export type MoveTicket = (ticketId: string, target: DropTarget) => Promise<void> | null;

export const moveMessage = (ticketKey: string, statusName: string | null): string =>
  statusName ? `${ticketKey} moved to ${statusName}` : `${ticketKey} moved`;

// React Query hands cache changes to React in batches it schedules, so a refused move's rollback
// still waits in one when the move settles. A batch scheduled now runs after it, and React
// renders each batch's changes before the next one runs.
const boardShown = (): Promise<void> =>
  new Promise((resolve) => {
    notifyManager.schedule(resolve);
  });

/** Drag and keyboard moves: renumber the destination group. */
export function useTicketMove(projectKey: string): MoveTicket {
  const readBoard = useBoardReader(projectKey);
  const { mutateAsync } = useMoveTicket();
  const { show } = useToast();
  return useCallback<MoveTicket>(
    (ticketId, target) => {
      const board = readBoard();
      const ticket = board?.tickets.find((candidate) => candidate.id === ticketId);
      const status = board?.statuses.find((candidate) => candidate.id === target.statusId);
      const plan = board && ticket ? planMove(board.tickets, ticketId, target) : null;
      if (!plan || !ticket || !status) return null;
      const input = {
        statusId: target.statusId,
        beforeId: target.beforeId ?? null,
        afterId: target.afterId ?? null,
      };
      const request = mutateAsync(
        { ticketKey: ticket.key, input },
        { onError: (error) => show(errorMessage(error)) },
      );
      flashRows([ticket.key]);
      // The toast is a polite status region too: announcing it twice would read the move twice.
      if (plan.statusChanged) show(moveMessage(ticket.key, status.name));
      else announce(moveMessage(ticket.key, null));
      return request.then(boardShown, boardShown);
    },
    [readBoard, mutateAsync, show],
  );
}
