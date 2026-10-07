export interface Point {
  x: number;
  y: number;
}

export type Axis = 'x' | 'y';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

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

// Apple's momentum projection: decide by where a flick would land, not where it was released.
export function projectDistance(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function lockAxis(dx: number, dy: number, slop = 8): Axis | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  return ax > ay ? 'x' : 'y';
}
