export interface Point {
  x: number;
  y: number;
}

export type Axis = 'x' | 'y';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

export const distance = (left: Point, right: Point): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

export const midpoint = (left: Point, right: Point): Point => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2,
});

// Same curve as UIScrollView so overscroll feels like iOS.
export function rubberBand(overflow: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0 || overflow === 0) return 0;
  const magnitude = Math.abs(overflow);
  const stretched = (1 - 1 / ((magnitude * constant) / dimension + 1)) * dimension;

  return Math.sign(overflow) * stretched;
}

export function rubberBandClamp(
  value: number,
  min: number,
  max: number,
  dimension: number,
): number {
  if (value < min) return min + rubberBand(value - min, dimension);
  if (value > max) return max + rubberBand(value - max, dimension);

  return value;
}

export function lockAxis(dx: number, dy: number, slop = 8): Axis | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;

  return ax > ay ? 'x' : 'y';
}
