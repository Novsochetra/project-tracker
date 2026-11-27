import type { DropTarget, TicketListItem } from '@tracker/shared';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotionNow } from '../../../lib/media';
import { settleRows } from '../../projects/reorder/reorderRows';
import type { MoveTicket } from '../useTicketMove';
import { listRows, releaseList, topInGroup } from './listRows';
import {
  listDrag,
  shownInGroups,
  type ListDragSession,
  type ListElements,
} from './listEnvironment';
import { useTicketDrag, type DragState, type TicketDrag } from './useTicketDrag';

export interface ListDragInput extends ListElements {
  // The board's tickets: a new list is the drop's move, shown.
  tickets: readonly TicketListItem[];
  move: MoveTicket;
}

export interface ListDrag extends TicketDrag {
  // The drag as the list draws it: from the drop until the move shows, the last frame's.
  shown: DragState | null;
}

interface Pending {
  shown: Map<string, number>;
}

function settle(container: HTMLElement | null, { shown }: Pending): void {
  const animate = releaseList(container);
  settleRows(listRows(container), shown, !prefersReducedMotionNow(), topInGroup);
  animate();
}

function useHeldDrag(drag: DragState | null, holding: boolean): DragState | null {
  const [last, setLast] = useState(drag);
  if (drag && drag !== last) setLast(drag);

  return drag ?? (holding ? last : null);
}

// The list's ticket drag: the rows slide aside to open the gap where the ticket lands, and keep
// their places from the drop until the move shows, so nothing jumps on the way.
export function useListDrag({ groups, scroller, tickets, move }: ListDragInput): ListDrag {
  const session = useRef<ListDragSession | null>(null);
  const pending = useRef<Pending | null>(null);
  const [holding, setHolding] = useState(false);

  const finish = useCallback(
    (waiting: Pending | null) => {
      if (!waiting || waiting !== pending.current) return;
      pending.current = null;
      settle(groups.current, waiting);
      setHolding(false);
    },
    [groups],
  );
  // Before the moved ticket is drawn in its new place.
  useLayoutEffect(() => finish(pending.current), [tickets, finish]);

  const environment = useCallback(
    (ticket: TicketListItem) => {
      const onEnd = (target: DropTarget | null) => {
        session.current = null;
        pending.current = { shown: shownInGroups(groups.current, ticket.id) };
        if (target) setHolding(true);
        else finish(pending.current);
      };

      session.current = listDrag({ groups, scroller }, ticket.id, onEnd);

      return session.current.env;
    },
    [finish, groups, scroller],
  );

  const onDrop = (ticket: TicketListItem, target: DropTarget) => {
    const waiting = pending.current;
    const moving = move(ticket.id, target);
    // The move's own render settles the rows; this covers one that doesn't move or never shows.
    if (moving) void moving.finally(() => finish(waiting));
    else finish(waiting);
  };

  const drag = useTicketDrag({ environment, onDrop });
  const dragging = drag.drag !== null;
  // After the drag's first render, which shows the empty groups' drop zones.
  useLayoutEffect(() => {
    if (dragging) session.current?.measure();
  }, [dragging]);

  return { ...drag, shown: useHeldDrag(drag.drag, holding) };
}
