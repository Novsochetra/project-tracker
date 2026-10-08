import type { DropTarget, Status, TicketListItem } from '@tracker/shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { haptic } from '../../../gestures';
import { isPhoneNow } from '../../../lib/media';
import { armClickGuard } from './clickGuard';
import { DragSession, type DragListener, type DragStart } from './DragSession';
import { sameTarget } from './dropTarget';
import { measureGroups } from './measure';

export interface DragState {
  ticket: TicketListItem;
  status: Status;
  origin: DragStart;
  target: DropTarget | null;
}

export type StartDrag = (
  event: ReactPointerEvent<HTMLElement>,
  ticket: TicketListItem,
  status: Status,
  fromHandle: boolean,
) => void;

export interface TicketDragOptions {
  containerRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  onDrop: (ticket: TicketListItem, target: DropTarget) => void;
}

export type GhostRef = (ghost: HTMLDivElement | null) => void;

export interface TicketDrag {
  drag: DragState | null;
  ghostRef: GhostRef;
  startDrag: StartDrag;
}

interface Delta {
  dx: number;
  dy: number;
}

// Grabbing cursor and no text selection everywhere while a ticket is dragged.
const setDocumentDragging = (dragging: boolean): void => {
  document.documentElement.toggleAttribute('data-ticket-drag', dragging);
};

const moveGhost = (ghost: HTMLElement | null, { dx, dy }: Delta): void => {
  if (ghost) ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
};

interface ListenerInput {
  ticket: TicketListItem;
  status: Status;
  touch: boolean;
  setDrag: (update: (current: DragState | null) => DragState | null) => void;
}

interface GhostPosition {
  ghost: RefObject<HTMLDivElement | null>;
  delta: RefObject<Delta>;
}

function dragListener(
  { ticket, status, touch, setDrag }: ListenerInput,
  { ghost, delta }: GhostPosition,
  onEnd: (target: DropTarget | null, started: boolean) => void,
): DragListener {
  return {
    onStart: (origin) => {
      delta.current = { dx: 0, dy: 0 };
      setDocumentDragging(true);
      if (touch) haptic('selection');
      setDrag(() => ({ ticket, status, origin, target: null }));
    },
    onFrame: ({ dx, dy, target }) => {
      delta.current = { dx, dy };
      moveGhost(ghost.current, delta.current);
      setDrag((current) =>
        current && !sameTarget(current.target, target) ? { ...current, target } : current,
      );
    },
    onEnd: ({ started, target }) => onEnd(target, started),
  };
}

/** Mouse drags start after 6px from the row or handle; touch and pen drag from the handle only. */
export function useTicketDrag({ containerRef, scrollRef, onDrop }: TicketDragOptions): TicketDrag {
  const [drag, setDrag] = useState<DragState | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const delta = useRef<Delta>({ dx: 0, dy: 0 });
  const onDropRef = useRef(onDrop);
  useLayoutEffect(() => {
    onDropRef.current = onDrop;
  });
  useEffect(() => {
    const sessions = sessionRef;
    return () => sessions.current?.cancel();
  }, []);
  // The ghost can mount after the first frame moved the pointer, so it starts where it should be.
  const ghostRef = useCallback<GhostRef>((element) => {
    ghost.current = element;
    moveGhost(element, delta.current);
  }, []);

  const startDrag = useCallback<StartDrag>(
    (event, ticket, status, fromHandle) => {
      const touch = event.pointerType !== 'mouse';
      if (sessionRef.current || event.button !== 0 || !event.isPrimary) return;
      if (touch && !fromHandle) return;
      if (fromHandle) event.preventDefault();
      const finish = (target: DropTarget | null, started: boolean) => {
        sessionRef.current = null;
        if (!started) return;
        setDocumentDragging(false);
        armClickGuard();
        setDrag(null);
        if (target) onDropRef.current(ticket, target);
      };
      const press = {
        ticketId: ticket.id,
        element: event.currentTarget,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        immediate: touch,
      };
      const env = {
        measure: () => measureGroups(containerRef.current),
        scroller: () => scrollRef.current,
        isPhone: isPhoneNow,
      };
      const listener = dragListener({ ticket, status, touch, setDrag }, { ghost, delta }, finish);
      sessionRef.current = new DragSession(press, env, listener);
    },
    [containerRef, scrollRef],
  );

  return { drag, ghostRef, startDrag };
}
