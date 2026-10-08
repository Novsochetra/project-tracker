export const EDGE_PAGE_ZONE = 32;
export const EDGE_PAGE_HOLD_MS = 500;

export type EdgeSide = -1 | 0 | 1;

export interface EdgePaging {
  // A drag that starts at an edge mustn't page by itself: that edge waits for the finger to leave.
  quiet: EdgeSide;
  hold: { side: -1 | 1; since: number } | null;
}

export interface EdgePageStep {
  paging: EdgePaging;
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
