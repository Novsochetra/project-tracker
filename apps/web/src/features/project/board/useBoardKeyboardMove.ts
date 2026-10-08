import { useCallback } from 'react';
import { buildColumns } from '../buildGroups';
import { requestHandleFocus } from '../dnd/handleFocus';
import type { HandleKeyDown } from '../dnd/useKeyboardMove';
import { getListView } from '../listViewStore';
import { useBoardReader } from '../useBoardReader';
import type { MoveTicket } from '../useTicketMove';
import { boardDirection, boardMoveTarget } from './boardMoves';

/** Arrow keys on a card's handle move it within its column (↑/↓) or across columns (←/→). */
export function useBoardKeyboardMove(projectKey: string, moveTicket: MoveTicket): HandleKeyDown {
  const readBoard = useBoardReader(projectKey);
  return useCallback<HandleKeyDown>(
    (event, ticket) => {
      const direction = boardDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      const board = readBoard();
      if (!board) return;
      const { statuses, tickets } = board;
      const columns = buildColumns({ ...getListView(projectKey), statuses, tickets });
      const target = boardMoveTarget(columns, ticket.id, direction);
      if (!target || !moveTicket(ticket.id, target)) return;
      requestHandleFocus(ticket.id);
    },
    [readBoard, moveTicket, projectKey],
  );
}
