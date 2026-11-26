import { useMotionValue, type MotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EASE_OUT, tween, type Stop } from '../gestures/animation';
import { wheelPixels } from '../lib/wheelPixels';
import type { HistorySteps } from './historySteps';
import { isTrackpadSwipeTarget } from './swipeTarget';
import {
  GESTURE_GAP_MS,
  IDLE_SWIPE,
  isSwipeComplete,
  ownsWheel,
  stepSwipe,
  swipeDirection,
  swipeProgress,
  type SwipeDirection,
  type TrackpadSwipe,
} from './trackpadSwipe';

export interface TrackpadSwipeInput {
  steps: HistorySteps;
  reducedMotion: boolean;
}

export interface TrackpadSwipeHint {
  progress: MotionValue<number>;
  direction: SwipeDirection | null;
}

const FADE = { durationMs: 200, ease: EASE_OUT };

interface SwipeOutput {
  progress: MotionValue<number>;
  setDirection: (direction: SwipeDirection | null) => void;
  read: () => TrackpadSwipeInput;
}

// Shift turns a mouse wheel sideways and Control is a pinch: neither is a swipe.
const isPlainWheel = (event: WheelEvent) => !event.shiftKey && !event.ctrlKey;

function attachTrackpadSwipe({ progress, setDirection, read }: SwipeOutput): () => void {
  let swipe: TrackpadSwipe = IDLE_SWIPE;
  let fadeTimer: number | undefined;
  let stopFade: Stop | null = null;

  const fadeOut = () => {
    stopFade?.();
    if (read().reducedMotion) progress.set(0);
    else stopFade = tween(progress, 0, FADE);
  };

  const show = (direction: SwipeDirection | null, value: number) => {
    stopFade?.();
    setDirection(direction);
    progress.set(value);
  };

  const track = () => {
    const direction = swipeDirection(swipe.distance);
    const { steps } = read();
    const possible = direction !== null && steps.canStep(direction);
    show(direction, possible ? swipeProgress(swipe.distance) : 0);
    if (!possible || !isSwipeComplete(swipe)) return;
    swipe = { ...swipe, phase: 'done' };
    steps.step(direction);
    fadeOut();
  };

  const onWheel = (event: WheelEvent) => {
    const { x, y } = wheelPixels(event, window.innerHeight);
    swipe = stepSwipe(
      swipe,
      { dx: x, dy: y, at: event.timeStamp },
      () => isPlainWheel(event) && isTrackpadSwipeTarget(event.target),
    );
    if (!ownsWheel(swipe)) return;
    // Otherwise Safari plays its own back swipe on top of this one.
    if (event.cancelable) event.preventDefault();
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(fadeOut, GESTURE_GAP_MS);
    if (swipe.phase === 'tracking') track();
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    window.removeEventListener('wheel', onWheel);
    window.clearTimeout(fadeTimer);
    stopFade?.();
  };
}

export function useTrackpadSwipe(input: TrackpadSwipeInput): TrackpadSwipeHint {
  const progress = useMotionValue(0);
  const [direction, setDirection] = useState<SwipeDirection | null>(null);
  const inputRef = useRef(input);
  useLayoutEffect(() => {
    inputRef.current = input;
  });
  useEffect(
    () => attachTrackpadSwipe({ progress, setDirection, read: () => inputRef.current }),
    [progress],
  );
  return { progress, direction };
}
