import type { Point } from '../../project/dnd/dropTarget';

// Long enough that a tap or the start of a scroll never lifts a row, and under Android's 500 ms
// long press, so the lift comes before the system's own.
export const LIFT_HOLD_MS = 400;
// A resting finger wanders a few pixels; iOS lets a long press move 10pt.
export const LIFT_SLOP = 10;

export interface HoldPress {
  pointerId: number;
  x: number;
  y: number;
}

export interface HoldCallbacks {
  onLift: (point: Point) => void;
  onGiveUp: () => void;
}

export const restsWithin = (press: Point, point: Point): boolean =>
  Math.abs(point.x - press.x) + Math.abs(point.y - press.y) < LIFT_SLOP;

// Waits for a finger to rest on a row. Moving past the slop, lifting the finger or a
// pointercancel (the browser took the touch for a scroll) gives up, so the list scrolls, pulls to
// refresh and taps as before. The returned function gives up early.
export function holdToLift(press: HoldPress, { onLift, onGiveUp }: HoldCallbacks): () => void {
  let point: Point = { x: press.x, y: press.y };

  const stop = () => {
    window.clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  const giveUp = () => {
    stop();
    onGiveUp();
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== press.pointerId) return;

    point = { x: event.clientX, y: event.clientY };
    if (!restsWithin(press, point)) giveUp();
  };

  const onEnd = (event: PointerEvent) => {
    if (event.pointerId === press.pointerId) giveUp();
  };

  const timer = window.setTimeout(() => {
    stop();
    onLift(point);
  }, LIFT_HOLD_MS);

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);

  return giveUp;
}
