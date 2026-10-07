import type { MotionValue } from 'motion/react';
import { DURATION } from '../design/motion';
import { EASE_IN, EASE_OUT, spring, tween, type Stop } from '../gestures/animation';

export const SLIDE_IN = { durationMs: DURATION.sheetIn, ease: EASE_OUT };
export const SLIDE_OUT = { durationMs: DURATION.sheetOut, ease: EASE_IN };
export const INSTANT = { durationMs: 0, ease: EASE_OUT };

export interface SlideValues {
  y: MotionValue<number>;
  travel: MotionValue<number>;
  opacity: MotionValue<number>;
}

export function slideIn(
  values: SlideValues,
  travel: number,
  reduced: boolean,
  first: boolean,
): Stop {
  values.travel.set(travel);
  if (first) {
    values.y.set(reduced ? 0 : travel);
    values.opacity.set(1);
  }
  return tween(values.y, 0, reduced ? INSTANT : SLIDE_IN);
}

export function slideOut(
  values: SlideValues,
  velocity: number,
  reduced: boolean,
  onDone: () => void,
): Stop {
  const travel = values.travel.get();
  if (reduced) return tween(values.y, travel, INSTANT, onDone);
  // A flick keeps its speed on the way out instead of restarting from a standstill.
  if (velocity > 0)
    return spring(values.y, travel, { velocity, visualDuration: 0.24, restDelta: 1 }, onDone);
  return tween(values.y, travel, SLIDE_OUT, onDone);
}
