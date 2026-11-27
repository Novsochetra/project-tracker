import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { prefersReducedMotionNow } from '../../../lib/media';
import { useLatest } from '../../../lib/useLatest';
import type { EdgeZones } from '../../project/dnd/autoScroll';
import { DragSession, type DragPress } from '../../project/dnd/DragSession';
import { moveInOrder, sameOrder } from '../../statuses/statusForm';
import { rowsIn, settleRows, shownTops } from './reorderRows';
import { rowDrag } from './rowDrag';
import { useHoldToLift } from './useHoldToLift';
import type { TouchLift } from './useLiftGuards';

export interface RowReorderOptions {
  ids: readonly string[];
  list: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  commit: (next: string[]) => void;
  // Touch and pen lift a row by resting on it (the phone list); without it they only scroll.
  holdToLift?: boolean;
  edges?: EdgeZones;
}

export interface RowReorder {
  startDrag: (event: PointerEvent<HTMLElement>, id: string) => void;
  // The new order when the key moved the row, else null.
  moveByKey: (event: KeyboardEvent<HTMLElement>, id: string) => string[] | null;
}

interface Settle {
  shown: Map<string, number>;
  focus: string | null;
}

const keyDelta = (event: KeyboardEvent): number => {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  if (event.key === 'ArrowUp') return -1;

  return event.key === 'ArrowDown' ? 1 : 0;
};

function settle(list: HTMLElement | null, { shown, focus }: Settle): void {
  const rows = rowsIn(list);
  settleRows(rows, shown, !prefersReducedMotionNow());
  const row = focus ? rows.get(focus) : undefined;
  // React moves rows to their new place, which can drop the focus of the one moved.
  if (row && row !== document.activeElement) row.focus({ preventScroll: true });
}

const pressOf = (event: PointerEvent<HTMLElement>): DragPress => ({
  element: event.currentTarget,
  pointerId: event.pointerId,
  x: event.clientX,
  y: event.clientY,
  immediate: false,
});

export function useRowReorder(options: RowReorderOptions): RowReorder {
  const { list, scroller } = options;
  const session = useRef<DragSession | null>(null);
  const lift = useRef<TouchLift>(null);
  const pending = useRef<Settle | null>(null);
  const latest = useLatest(options);

  useEffect(() => () => session.current?.cancel(), []);
  // Runs before the new order is drawn, so the rows glide from where they were shown.
  useLayoutEffect(() => {
    const waiting = pending.current;
    pending.current = null;
    if (waiting) settle(list.current, waiting);
  }, [options.ids, list]);

  const apply = useCallback(
    (next: string[] | null, waiting: Settle) => {
      const current = latest.current;
      if (!next || sameOrder(next, current.ids)) {
        settle(list.current, waiting);
        return;
      }

      pending.current = waiting;
      current.commit(next);
    },
    [latest, list],
  );

  const drag = useCallback(
    (press: DragPress, id: string) => {
      const element = list.current;
      if (!element) return;

      const { env, listener } = rowDrag({
        id,
        ids: latest.current.ids,
        list: element,
        scroller: scroller.current,
        edges: latest.current.edges,
        onDrop: (next, shown) => apply(next, { shown, focus: null }),
      });
      session.current = new DragSession(press, env, {
        ...listener,
        onEnd: (end) => {
          session.current = null;
          lift.current = null;
          listener.onEnd(end);
        },
      });
    },
    [apply, latest, list, scroller],
  );

  const hold = useHoldToLift({ list, liftRef: lift, enabled: options.holdToLift === true, drag });

  const startDrag = useCallback(
    (event: PointerEvent<HTMLElement>, id: string) => {
      if (event.button !== 0 || session.current || lift.current) return;

      // A mouse drags at once. Touch and pen scroll, unless this list lifts a row they rest on.
      if (event.pointerType === 'mouse') drag(pressOf(event), id);
      else if (latest.current.holdToLift && event.isPrimary) hold(pressOf(event), id);
    },
    [drag, hold, latest],
  );

  const moveByKey = useCallback(
    (event: KeyboardEvent<HTMLElement>, id: string) => {
      const delta = keyDelta(event);
      if (!delta) return null;
      event.preventDefault();
      const next = moveInOrder(latest.current.ids, id, delta);
      if (next) apply(next, { shown: shownTops(rowsIn(list.current)), focus: id });

      return next;
    },
    [apply, latest, list],
  );

  return { startDrag, moveByKey };
}
