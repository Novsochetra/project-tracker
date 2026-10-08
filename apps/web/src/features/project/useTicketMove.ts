import { planMove, type DropTarget } from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, useMoveTicket } from '../../api';
import { announce } from '../../app/announce';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { useBoardReader } from './useBoardReader';

export type MoveTicket = (ticketId: string, target: DropTarget) => boolean;

export const moveMessage = (ticketKey: string, statusName: string | null): string =>
  statusName ? `${ticketKey} moved to ${statusName}` : `${ticketKey} moved`;

/** Drag and keyboard moves: renumber the destination group; returns false when nothing moves. */
export function useTicketMove(projectKey: string): MoveTicket {
  const readBoard = useBoardReader(projectKey);
  const { mutate } = useMoveTicket();
  const { show } = useToast();
  return useCallback<MoveTicket>(
    (ticketId, target) => {
      const board = readBoard();
      const ticket = board?.tickets.find((candidate) => candidate.id === ticketId);
      const status = board?.statuses.find((candidate) => candidate.id === target.statusId);
      const plan = board && ticket ? planMove(board.tickets, ticketId, target) : null;
      if (!plan || !ticket || !status) return false;
      const input = {
        statusId: target.statusId,
        beforeId: target.beforeId ?? null,
        afterId: target.afterId ?? null,
      };
      mutate({ ticketKey: ticket.key, input }, { onError: (error) => show(errorMessage(error)) });
      flashRows([ticket.key]);
      // The toast is a polite status region too: announcing it twice would read the move twice.
      if (plan.statusChanged) show(moveMessage(ticket.key, status.name));
      else announce(moveMessage(ticket.key, null));
      return true;
    },
    [readBoard, mutate, show],
  );
}
