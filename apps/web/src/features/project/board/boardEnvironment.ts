import type { RefObject } from 'react';
import { haptic } from '../../../gestures';
import { prefersReducedMotionNow } from '../../../lib/media';
import { AUTO_SCROLL_BOTTOM_PHONE, edgeScrollStep, scrollAlong } from '../dnd/autoScroll';
import type { DragEnvironment } from '../dnd/DragSession';
import { columnAt, columnDropTarget, targetInGroup, type Point } from '../dnd/dropTarget';
import { measureGroups } from '../dnd/measure';
import { startEdgePaging, stepEdgePaging } from './edgePaging';
import { columnElements, measurePage } from './boardSpans';

/** Desktop: how close to the board's left or right edge the pointer scrolls it sideways. */
export const BOARD_SIDE_ZONE = 56;
/** How close to the top or bottom of a column's cards the pointer scrolls that column. */
export const COLUMN_EDGE_ZONE = 48;

/** Scrolls a column's cards when the pointer nears their top or bottom edge. */
function scrollColumn(column: Element | undefined, y: number, bottomZone: number): boolean {
  const body = column?.querySelector<HTMLElement>('[data-column-body]');
  if (!body) return false;
  const rect = body.getBoundingClientRect();
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const zones = { start: COLUMN_EDGE_ZONE, end: bottomZone };
  return scrollAlong(body, 'y', edgeScrollStep(y, rect.top, bottom, zones));
}

function columnUnder(board: HTMLElement, x: number): Element | undefined {
  const spans = columnElements(board).map((element) => {
    const { left, right } = element.getBoundingClientRect();
    return { element, left, right };
  });
  return columnAt(spans, x)?.element;
}

/** Pages the phone board by one column, the way a swipe would. */
function pageBoard(board: HTMLElement, side: -1 | 1): void {
  const columns = columnElements(board);
  const page = measurePage(board);
  const from = columns[page];
  const to = columns[page + side];
  if (!from || !to) return;
  const left = to.getBoundingClientRect().left - from.getBoundingClientRect().left;
  board.scrollBy({ left, behavior: prefersReducedMotionNow() ? 'auto' : 'smooth' });
  haptic('selection');
}

/** Desktop board: the column under the pointer by x; the board and columns scroll near edges. */
export function desktopBoardEnvironment(
  board: RefObject<HTMLElement | null>,
  ticketId: string,
): DragEnvironment {
  return {
    targetAt: (point) => columnDropTarget(measureGroups(board.current), point, ticketId),
    autoScroll: (point) => {
      const element = board.current;
      if (!element) return false;
      const { left, right } = element.getBoundingClientRect();
      const zones = { start: BOARD_SIDE_ZONE, end: BOARD_SIDE_ZONE };
      const sideways = scrollAlong(element, 'x', edgeScrollStep(point.x, left, right, zones));
      return scrollColumn(columnUnder(element, point.x), point.y, COLUMN_EDGE_ZONE) || sideways;
    },
  };
}

/**
 * Phone board: the card moves within the column on screen; resting the finger near the screen's
 * left or right edge pages to the neighbouring column.
 */
export function phoneBoardEnvironment(
  board: RefObject<HTMLElement | null>,
  ticketId: string,
  press: Point,
): DragEnvironment {
  let paging = startEdgePaging(press.x, window.innerWidth);
  return {
    targetAt: (point) => {
      const element = board.current;
      const column = element ? measureGroups(element)[measurePage(element)] : undefined;
      return column ? targetInGroup(column, point.y, ticketId) : null;
    },
    autoScroll: (point, now) => {
      const element = board.current;
      if (!element) return false;
      const step = stepEdgePaging(paging, point.x, window.innerWidth, now);
      paging = step.paging;
      if (step.page !== 0) pageBoard(element, step.page);
      const column = columnElements(element)[measurePage(element)];
      return scrollColumn(column, point.y, AUTO_SCROLL_BOTTOM_PHONE);
    },
  };
}
