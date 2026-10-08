import {
  keyboardMoveTarget,
  visibleStatuses,
  type MoveDirection,
  type TicketFilter,
  type TicketListItem,
} from '@tracker/shared';
import { useCallback, type KeyboardEvent } from 'react';
import { expandGroup } from '../expandedStore';
import { useBoardReader } from '../useBoardReader';
import type { MoveTicket } from '../useTicketMove';
import { requestHandleFocus } from './handleFocus';

export type HandleKeyDown = (event: KeyboardEvent<HTMLElement>, ticket: TicketListItem) => void;

const arrowDirection = (key: string): MoveDirection | null => {
  if (key === 'ArrowUp') return 'up';
  return key === 'ArrowDown' ? 'down' : null;
};

/** ↑/↓ on a handle move the ticket one slot, crossing into the next visible group at the edge. */
export function useKeyboardMove(
  projectKey: string,
  filter: TicketFilter,
  moveTicket: MoveTicket,
): HandleKeyDown {
  const readBoard = useBoardReader(projectKey);
  return useCallback<HandleKeyDown>(
    (event, ticket) => {
      const direction = arrowDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      const board = readBoard();
      if (!board) return;
      const order = visibleStatuses(board.statuses, filter).map((status) => status.id);
      const target = keyboardMoveTarget(board.tickets, ticket.id, direction, order);
      if (!target) return;
      const move = moveTicket(ticket.id, target);
      if (!move) return;
      expandGroup(projectKey, target.statusId);
      const releaseFocus = requestHandleFocus(ticket.id);
      void move.then(releaseFocus);
    },
    [readBoard, filter, moveTicket, projectKey],
  );
}
