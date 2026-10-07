import { useMotionValue, type MotionValue } from 'motion/react';
import { useMemo } from 'react';
import { spring, stopAll, type Stop } from '../gestures/animation';
import { IDENTITY, type ZoomState } from '../gestures/zoomMath';

export interface ViewerValues {
  track: MotionValue<number>;
  scale: MotionValue<number>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  backdrop: MotionValue<number>;
  opacity: MotionValue<number>;
  stageScale: MotionValue<number>;
}

export function useViewerValues(): ViewerValues {
  const track = useMotionValue(0);
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const backdrop = useMotionValue(1);
  const opacity = useMotionValue(0);
  const stageScale = useMotionValue(0.96);
  return useMemo(
    () => ({ track, scale, x, y, backdrop, opacity, stageScale }),
    [track, scale, x, y, backdrop, opacity, stageScale],
  );
}

const ZOOM = { visualDuration: 0.32, restDelta: 0.001 };
const PAN = { visualDuration: 0.32, restDelta: 0.5 };

export const readZoom = (values: ViewerValues): ZoomState => ({
  scale: values.scale.get(),
  x: values.x.get(),
  y: values.y.get(),
});

export function setZoom(values: ViewerValues, state: ZoomState): void {
  values.scale.set(state.scale);
  values.x.set(state.x);
  values.y.set(state.y);
}

export function stopZoom(values: ViewerValues): void {
  values.scale.stop();
  values.x.stop();
  values.y.stop();
}

export function animateZoom(values: ViewerValues, target: ZoomState, reduced: boolean): Stop {
  if (reduced) {
    setZoom(values, target);
    return () => undefined;
  }
  const stops = [
    spring(values.scale, target.scale, ZOOM),
    spring(values.x, target.x, PAN),
    spring(values.y, target.y, PAN),
  ];
  return () => stopAll(stops);
}

export function resetDismiss(values: ViewerValues, reduced: boolean): void {
  animateZoom(values, IDENTITY, reduced);
  if (reduced) values.backdrop.set(1);
  else spring(values.backdrop, 1, { visualDuration: 0.32, restDelta: 0.001 });
}
