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
import { DragSession } from '../../project/dnd/DragSession';
import { moveInOrder, sameOrder } from '../../statuses/statusForm';
import { rowsIn, settleRows, shownTops } from './reorderRows';
import { rowDrag } from './rowDrag';

export interface RowReorderOptions {
  ids: readonly string[];
  list: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  commit: (next: string[]) => void;
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

export function useRowReorder({ ids, list, scroller, commit }: RowReorderOptions): RowReorder {
  const session = useRef<DragSession | null>(null);
  const pending = useRef<Settle | null>(null);
  const latest = useLatest({ ids, commit });

  useEffect(() => () => session.current?.cancel(), []);
  // Runs before the new order is drawn, so the rows glide from where they were shown.
  useLayoutEffect(() => {
    const waiting = pending.current;
    pending.current = null;
    if (waiting) settle(list.current, waiting);
  }, [ids, list]);

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

  const startDrag = useCallback(
    (event: PointerEvent<HTMLElement>, id: string) => {
      // Touch and pen scroll the sidebar; a mouse drags.
      if (event.pointerType !== 'mouse' || event.button !== 0 || session.current) return;
      const element = list.current;
      if (!element) return;
      const { env, listener } = rowDrag({
        id,
        ids: latest.current.ids,
        list: element,
        scroller: scroller.current,
        onDrop: (next, shown) => apply(next, { shown, focus: null }),
      });
      const press = {
        element: event.currentTarget,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        immediate: false,
      };
      session.current = new DragSession(press, env, {
        ...listener,
        onEnd: (end) => {
          session.current = null;
          listener.onEnd(end);
        },
      });
    },
    [apply, latest, list, scroller],
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
