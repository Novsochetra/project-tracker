import { animate, type MotionValue } from 'motion/react';
import { EASE } from '../design/motion';

export type Bezier = readonly [number, number, number, number];

export const EASE_OUT: Bezier = EASE.out;
export const EASE_IN: Bezier = EASE.in;
// UIKit's navigation push curve; the 240ms SPEC fade felt abrupt for a full-width slide.
export const EASE_IOS: Bezier = [0.32, 0.72, 0, 1];

export type Stop = () => void;

export interface SpringSettings {
  velocity?: number;
  visualDuration?: number;
  bounce?: number;
  restDelta?: number;
}

export interface GlideSettings {
  velocity: number;
  min: number;
  max: number;
}

function guarded(onDone: (() => void) | undefined): { done: () => void; cancel: () => void } {
  let active = true;
  return {
    done: () => {
      if (active) onDone?.();
    },
    cancel: () => {
      active = false;
    },
  };
}

export function tween(
  value: MotionValue<number>,
  to: number,
  timing: { durationMs: number; ease: Bezier },
  onDone?: () => void,
): Stop {
  const guard = guarded(onDone);
  const controls = animate(value, to, {
    duration: timing.durationMs / 1000,
    ease: timing.ease,
    onComplete: guard.done,
  });
  return () => {
    guard.cancel();
    controls.stop();
  };
}

export function spring(
  value: MotionValue<number>,
  to: number,
  settings: SpringSettings,
  onDone?: () => void,
): Stop {
  const guard = guarded(onDone);
  const restDelta = settings.restDelta ?? 0.5;
  // Without an explicit velocity motion keeps the value's current one, so re-targets stay smooth.
  const velocity = settings.velocity === undefined ? {} : { velocity: settings.velocity };
  const controls = animate(value, to, {
    type: 'spring',
    ...velocity,
    visualDuration: settings.visualDuration ?? 0.35,
    bounce: settings.bounce ?? 0,
    restDelta,
    restSpeed: restDelta * 10,
    onComplete: guard.done,
  });
  return () => {
    guard.cancel();
    controls.stop();
  };
}

export interface MomentumSettings {
  velocity: number;
  minMs: number;
  maxMs: number;
}

// Initial slope of EASE_IOS (y1 / x1): its starting speed is this many times the average speed.
const IOS_START_SLOPE = 0.72 / 0.32;

export function momentumDuration(distance: number, settings: MomentumSettings): number {
  const towardTarget = distance !== 0 && Math.sign(settings.velocity) === Math.sign(distance);
  const speed = towardTarget ? Math.abs(settings.velocity) : 0;
  const ideal =
    speed > 0 ? ((IOS_START_SLOPE * Math.abs(distance)) / speed) * 1000 : settings.maxMs;
  return Math.min(settings.maxMs, Math.max(settings.minMs, ideal));
}

// Not a spring: a spring's long tail would delay what comes after the release.
export function momentum(
  value: MotionValue<number>,
  to: number,
  settings: MomentumSettings,
  onDone?: () => void,
): Stop {
  const durationMs = momentumDuration(to - value.get(), settings);
  return tween(value, to, { durationMs, ease: EASE_IOS }, onDone);
}

export function glide(
  value: MotionValue<number>,
  settings: GlideSettings,
  onDone?: () => void,
): Stop {
  const guard = guarded(onDone);
  const controls = animate(value, value.get(), {
    type: 'inertia',
    velocity: settings.velocity,
    min: settings.min,
    max: settings.max,
    power: 0.6,
    timeConstant: 320,
    bounceStiffness: 320,
    bounceDamping: 36,
    restDelta: 0.5,
    onComplete: guard.done,
  });
  return () => {
    guard.cancel();
    controls.stop();
  };
}

export function stopAll(stops: Stop[]): void {
  for (const stop of stops) stop();
}
