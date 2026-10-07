import { useLayoutEffect, useRef, type RefObject } from 'react';
import { DURATION } from '../design/motion';
import { EASE_IN, EASE_OUT, spring, stopAll, tween } from '../gestures/animation';
import { IDENTITY, type Size } from '../gestures/zoomMath';
import { INSTANT } from './slide';
import { pageStride, snapTrack, type ViewerGestureContext } from './viewerModes';
import { setZoom, type ViewerValues } from './viewerValues';

export interface ViewerPresenceInput {
  open: boolean;
  values: ViewerValues;
  viewport: Size;
  reducedMotion: boolean;
  dismissVelocityRef: RefObject<number | null>;
  onExited: () => void;
}

function exitAfterSwipe(
  values: ViewerValues,
  viewport: Size,
  velocity: number,
  onExited: () => void,
) {
  const fall = values.y.get() + viewport.height / 2;
  const stops = [
    spring(values.y, fall, { velocity, visualDuration: 0.3, restDelta: 1 }),
    tween(values.opacity, 0, { durationMs: DURATION.base, ease: EASE_OUT }, onExited),
  ];
  return () => stopAll(stops);
}

function fade(values: ViewerValues, open: boolean, reduced: boolean, onExited: () => void) {
  const timing = reduced
    ? INSTANT
    : open
      ? { durationMs: DURATION.base, ease: EASE_OUT }
      : { durationMs: DURATION.fast, ease: EASE_IN };
  const stops = [
    tween(values.opacity, open ? 1 : 0, timing, open ? undefined : onExited),
    tween(values.stageScale, open ? 1 : 0.96, timing),
  ];
  return () => stopAll(stops);
}

export function useViewerPresence(input: ViewerPresenceInput): void {
  const { open, values, viewport, reducedMotion, dismissVelocityRef, onExited } = input;
  useLayoutEffect(() => {
    if (open) return fade(values, true, reducedMotion, onExited);
    const velocity = dismissVelocityRef.current;
    dismissVelocityRef.current = null;
    if (velocity !== null && !reducedMotion)
      return exitAfterSwipe(values, viewport, velocity, onExited);
    return fade(values, false, reducedMotion, onExited);
  }, [open, values, viewport, reducedMotion, dismissVelocityRef, onExited]);
}

export function useTrackSync(
  ctx: Pick<ViewerGestureContext, 'values' | 'index' | 'viewport' | 'reducedMotion'>,
): void {
  const { values, index, viewport, reducedMotion } = ctx;
  const stride = pageStride(viewport);
  const syncedRef = useRef<{ index: number; stride: number } | null>(null);
  useLayoutEffect(() => {
    const synced = syncedRef.current;
    syncedRef.current = { index, stride };
    if (synced?.index === index && synced.stride === stride) return;
    setZoom(values, IDENTITY);
    if (synced === null || synced.stride !== stride) values.track.set(-index * stride);
    else snapTrack(values, index, stride, { reduced: reducedMotion });
  }, [values, index, stride, reducedMotion]);
}
