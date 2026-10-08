/** How close to the screen's left or right edge a dragging finger asks for the next column. */
export const EDGE_PAGE_ZONE = 32;
/** How long the finger rests there before the board pages, and again for each further page. */
export const EDGE_PAGE_HOLD_MS = 500;

export type EdgeSide = -1 | 0 | 1;

export interface EdgePaging {
  /** The edge the drag started in pages only after the finger has left it once. */
  quiet: EdgeSide;
  hold: { side: -1 | 1; since: number } | null;
}

export interface EdgePageStep {
  paging: EdgePaging;
  /** -1 pages to the previous column, 1 to the next, 0 stays. */
  page: EdgeSide;
}

export function edgeSide(x: number, width: number): EdgeSide {
  if (x <= EDGE_PAGE_ZONE) return -1;
  return x >= width - EDGE_PAGE_ZONE ? 1 : 0;
}

export const startEdgePaging = (x: number, width: number): EdgePaging => ({
  quiet: edgeSide(x, width),
  hold: null,
});

/** One tick of a phone drag: page once the finger has rested near an edge for a short hold. */
export function stepEdgePaging(
  paging: EdgePaging,
  x: number,
  width: number,
  now: number,
): EdgePageStep {
  const side = edgeSide(x, width);
  if (side === 0) return { paging: { quiet: 0, hold: null }, page: 0 };
  if (side === paging.quiet) return { paging, page: 0 };
  if (paging.hold?.side !== side) {
    return { paging: { quiet: 0, hold: { side, since: now } }, page: 0 };
  }
  if (now - paging.hold.since < EDGE_PAGE_HOLD_MS) return { paging, page: 0 };
  return { paging: { quiet: 0, hold: { side, since: now } }, page: side };
}
