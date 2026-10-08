import { notifyManager } from '@tanstack/react-query';
import { planMove, type DropTarget } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useMoveTicket } from '../../api';
import { announce } from '../../app/announce';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { moveMessage } from './moveMessage';
import { useMoveToast, wasSaved } from './undo/useMoveToast';
import { useBoardReader } from './useBoardReader';

export type MoveTicket = (ticketId: string, target: DropTarget) => Promise<void> | null;

// React Query hands cache changes to React in batches it schedules, so a refused move's rollback
// still waits in one when the move settles. A batch scheduled now runs after it, and React
// renders each batch's changes before the next one runs.
const boardShown = (): Promise<void> =>
  new Promise((resolve) => {
    notifyManager.schedule(resolve);
  });

export function useTicketMove(projectKey: string): MoveTicket {
  const readBoard = useBoardReader(projectKey);
  const { mutateAsync } = useMoveTicket();
  const { show } = useToast();
  const showMove = useMoveToast();
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
        { onError: (error) => show(errorMessage(error), { kind: 'error' }) },
      );
      flashRows([ticket.key]);
      // The toast is a polite status region too: announcing it twice would read the move twice.
      if (plan.statusChanged) showMove(ticket, status, wasSaved(request));
      else announce(moveMessage(ticket.key, null));
      return request.then(boardShown, boardShown);
    },
    [readBoard, mutateAsync, show, showMove],
  );
}
