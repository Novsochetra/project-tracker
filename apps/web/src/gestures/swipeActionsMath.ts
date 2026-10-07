import { lerp, rubberBandClamp } from './math';

export type SwipeSide = 'leading' | 'trailing';

export type SwipeOutcome =
  { kind: 'close' } | { kind: 'open'; side: SwipeSide } | { kind: 'full'; side: SwipeSide };

export interface SwipeGeometry {
  rowWidth: number;
  leadingCount: number;
  trailingCount: number;
}

export const ACTION_WIDTH = 76;
export const FULL_SWIPE_RATIO = 0.55;
export const OPEN_VELOCITY = 300;

export const openWidth = (count: number): number => count * ACTION_WIDTH;

export const sideOf = (offset: number): SwipeSide | null =>
  offset > 0 ? 'leading' : offset < 0 ? 'trailing' : null;

const countFor = (side: SwipeSide, geometry: SwipeGeometry): number =>
  side === 'leading' ? geometry.leadingCount : geometry.trailingCount;

export function swipeOffset(raw: number, geometry: SwipeGeometry): number {
  const max = geometry.leadingCount > 0 ? geometry.rowWidth : 0;
  const min = geometry.trailingCount > 0 ? -geometry.rowWidth : 0;
  if ((raw > 0 && max === 0) || (raw < 0 && min === 0)) return 0;
  return rubberBandClamp(raw, min, max, geometry.rowWidth / 2);
}

export const isFullSwipe = (offset: number, rowWidth: number): boolean =>
  rowWidth > 0 && Math.abs(offset) >= rowWidth * FULL_SWIPE_RATIO;

export function swipeOutcome(
  offset: number,
  velocity: number,
  geometry: SwipeGeometry,
): SwipeOutcome {
  const side = sideOf(offset);
  if (side === null || countFor(side, geometry) === 0) return { kind: 'close' };
  if (isFullSwipe(offset, geometry.rowWidth)) return { kind: 'full', side };
  const towardOpen = side === 'leading' ? velocity : -velocity;
  if (towardOpen > OPEN_VELOCITY) return { kind: 'open', side };
  if (towardOpen < -OPEN_VELOCITY) return { kind: 'close' };
  const width = openWidth(countFor(side, geometry));
  return Math.abs(offset) > width / 2 ? { kind: 'open', side } : { kind: 'close' };
}

export function restingOffset(outcome: SwipeOutcome, geometry: SwipeGeometry): number {
  if (outcome.kind !== 'open') return 0;
  const width = openWidth(countFor(outcome.side, geometry));
  return outcome.side === 'leading' ? width : -width;
}

// Like iOS Mail the buttons share the revealed space, and on a full swipe the outermost one
// (index 0) grows over the others; edges are measured from the row's side.
export function actionEdge(reveal: number, index: number, count: number, full: number): number {
  if (count <= 0) return 0;
  const share = (Math.max(0, reveal) / count) * (index + 1);
  return index === 0 ? lerp(share, Math.max(0, reveal), full) : share;
}

export function actionLabelOffset(
  reveal: number,
  index: number,
  count: number,
  full: number,
): number {
  const slice = count <= 0 ? 0 : Math.max(0, reveal) / count;
  const centred = (slice - ACTION_WIDTH) / 2;
  return index === 0 ? lerp(centred, 0, full) : centred;
}
