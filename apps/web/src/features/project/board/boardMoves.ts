import type { DropTarget } from '@tracker/shared';
import type { TicketGroupData } from '../buildGroups';

export type BoardDirection = 'up' | 'down' | 'left' | 'right';

const ARROWS: Readonly<Record<string, BoardDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export const boardDirection = (key: string): BoardDirection | null => ARROWS[key] ?? null;

interface Place {
  column: number;
  row: number;
}

function locate(columns: readonly TicketGroupData[], ticketId: string): Place | null {
  for (const [column, { tickets }] of columns.entries()) {
    const row = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (row >= 0) return { column, row };
  }
  return null;
}

function slotIn(column: TicketGroupData, ticketId: string, index: number): DropTarget {
  const ids = column.tickets.map((ticket) => ticket.id).filter((id) => id !== ticketId);
  return {
    statusId: column.status.id,
    beforeId: ids[index] ?? null,
    afterId: ids[index - 1] ?? null,
  };
}

export function boardMoveTarget(
  columns: readonly TicketGroupData[],
  ticketId: string,
  direction: BoardDirection,
): DropTarget | null {
  const place = locate(columns, ticketId);
  const own = place && columns[place.column];
  if (!place || !own) return null;
  switch (direction) {
    case 'up':
      return place.row > 0 ? slotIn(own, ticketId, place.row - 1) : null;
    case 'down':
      return place.row < own.tickets.length - 1 ? slotIn(own, ticketId, place.row + 1) : null;
    case 'left':
    case 'right': {
      const next = columns[place.column + (direction === 'left' ? -1 : 1)];
      return next ? slotIn(next, ticketId, Math.min(place.row, next.tickets.length)) : null;
    }
  }
}
