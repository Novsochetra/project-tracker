import { clamp, distance, type Point } from '../gestures/math';

export const PAGE_GAP = 20;
export const PAGE_VELOCITY = 400;
export const DISMISS_FLICK = 900;
export const TAP_SLOP = 10;
export const TAP_MS = 300;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_DISTANCE = 40;

export interface PageRelease {
  offset: number;
  velocity: number;
  stride: number;
  index: number;
  count: number;
}

export function pageTarget({ offset, velocity, stride, index, count }: PageRelease): number {
  if (stride <= 0 || count <= 0) return index;
  const position = index - offset / stride;
  const flicked = Math.abs(velocity) >= PAGE_VELOCITY;
  const target = flicked
    ? velocity < 0
      ? Math.ceil(position)
      : Math.floor(position)
    : Math.round(position);
  return clamp(target, Math.max(0, index - 1), Math.min(count - 1, index + 1));
}

export function shouldDismissViewer(dy: number, velocityY: number, height: number): boolean {
  if (dy <= 0) return false;
  if (velocityY >= DISMISS_FLICK) return true;
  if (velocityY < 0) return false;
  return dy >= Math.min(140, height * 0.18);
}

export const dismissProgress = (dy: number, height: number): number =>
  height <= 0 ? 0 : clamp(Math.abs(dy) / (height * 0.5), 0, 1);

export const dismissScale = (progress: number): number => 1 - 0.2 * progress;

export interface Tap extends Point {
  t: number;
}

export const isTap = (start: Tap, end: Tap): boolean =>
  end.t - start.t <= TAP_MS && distance(start, end) <= TAP_SLOP;

export const isDoubleTap = (previous: Tap | null, next: Tap): boolean =>
  previous !== null &&
  next.t - previous.t <= DOUBLE_TAP_MS &&
  distance(previous, next) <= DOUBLE_TAP_DISTANCE;
