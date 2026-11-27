import type { DropTarget } from '@tracker/shared';
import { edgeScrollStep, scrollAlong, type EdgeZones } from '../../project/dnd/autoScroll';
import { armClickGuard } from '../../project/dnd/clickGuard';
import type { DragEnvironment, DragListener } from '../../project/dnd/DragSession';
import { sameTarget, targetInGroup, type RowBox } from '../../project/dnd/dropTarget';
import { clampOffset, orderAfterDrop, rowShifts, slotStep } from './reorderMath';
import { moveRow, rowsIn, shownTops, type RowElements } from './reorderRows';

export interface RowDragInput {
  id: string;
  ids: readonly string[];
  list: HTMLElement;
  scroller: HTMLElement | null;
  // How near the scroller's top and bottom the pointer scrolls it; the sidebar's by default.
  edges?: EdgeZones | undefined;
  onDrop: (next: string[] | null, shown: Map<string, number>) => void;
}

interface Measured {
  rows: RowElements;
  boxes: RowBox[];
  from: number;
  step: number;
  listTop: number;
}

const SIDEBAR_EDGES: EdgeZones = { start: 32, end: 32, capped: true };
const DRAG_ATTRIBUTE = 'data-row-drag';

// Grabbing cursor and no text selection anywhere while a row is dragged.
const setDocumentDragging = (dragging: boolean): void => {
  document.documentElement.toggleAttribute(DRAG_ATTRIBUTE, dragging);
};

function measure(input: RowDragInput): Measured {
  const rows = rowsIn(input.list);
  const listTop = input.list.getBoundingClientRect().top;
  const boxes = [...rows].map(([id, row]) => {
    const rect = row.getBoundingClientRect();

    return { id, top: rect.top - listTop, height: rect.height };
  });
  const from = boxes.findIndex((box) => box.id === input.id);

  return { rows, boxes, from, step: slotStep(boxes, from), listTop };
}

// Rows are measured once, when the drag starts; each frame only reads where the list is now (it
// scrolls with the sidebar) and writes transforms, so nothing re-renders while the pointer moves.
export function rowDrag(input: RowDragInput): {
  env: DragEnvironment;
  listener: DragListener;
} {
  let measured: Measured | null = null;
  let listTop = 0;
  let shownTarget: DropTarget | null = null;

  const targetAt = (y: number): DropTarget | null => {
    if (!measured) return null;
    listTop = input.list.getBoundingClientRect().top;
    const rows = measured.boxes.map((box) => ({ ...box, top: box.top + listTop }));
    const group = { statusId: '', top: 0, bottom: 0, left: 0, right: 0, rows };

    return targetInGroup(group, y, input.id);
  };

  const showTarget = (target: DropTarget | null): void => {
    if (!measured || !target || sameTarget(target, shownTarget)) return;
    shownTarget = target;
    const shifts = rowShifts(input.ids, orderAfterDrop(input.ids, input.id, target), measured.step);
    for (const [id, shift] of shifts) if (id !== input.id) moveRow(measured.rows.get(id), shift);
  };

  const env: DragEnvironment = {
    targetAt: (point) => targetAt(point.y),
    autoScroll: (point) => {
      const box = input.scroller?.getBoundingClientRect();
      if (!box) return false;
      const step = edgeScrollStep(point.y, box.top, box.bottom, input.edges ?? SIDEBAR_EDGES);

      return scrollAlong(input.scroller, 'y', step);
    },
  };

  const listener: DragListener = {
    onStart: () => {
      measured = measure(input);
      listTop = measured.listTop;
      setDocumentDragging(true);
      measured.rows.get(input.id)?.setAttribute('data-dragging', '');
    },
    onFrame: ({ dy, target }) => {
      if (!measured) return;
      const offset = clampOffset(measured.boxes, measured.from, dy + measured.listTop - listTop);
      moveRow(measured.rows.get(input.id), offset);
      showTarget(target);
    },
    onEnd: ({ started, target }) => {
      if (!started || !measured) return;
      setDocumentDragging(false);
      armClickGuard();
      const shown = shownTops(measured.rows);
      measured.rows.get(input.id)?.removeAttribute('data-dragging');
      input.onDrop(target ? orderAfterDrop(input.ids, input.id, target) : null, shown);
    },
  };

  return { env, listener };
}
