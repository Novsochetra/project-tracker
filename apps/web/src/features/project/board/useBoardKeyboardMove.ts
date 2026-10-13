import { useCallback } from 'react';
import { buildColumns } from '../buildGroups';
import { requestHandleFocus } from '../dnd/handleFocus';
import type { HandleKeyDown } from '../dnd/useKeyboardMove';
import { getListView, pickedLabel } from '../listViewStore';
import { useBoardReader } from '../useBoardReader';
import type { MoveTicket } from '../useTicketMove';
import { boardDirection, boardMoveTarget } from './boardMoves';

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
      const view = getListView(projectKey);
      const label = pickedLabel(view, board.labels)?.id;
      const columns = buildColumns({ ...view, label, statuses, tickets });
      const target = boardMoveTarget(columns, ticket.id, direction);
      const move = target && moveTicket(ticket.id, target);
      if (!move) return;
      const releaseFocus = requestHandleFocus(ticket.id);
      void move.then(releaseFocus);
    },
    [readBoard, moveTicket, projectKey],
  );
}
