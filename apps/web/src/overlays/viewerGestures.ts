import { doubleTapZoom } from '../gestures/zoomMath';
import { DOUBLE_TAP_MS, isDoubleTap, isTap, type Tap } from './viewerMath';
import {
  beginPinch,
  createGestureState,
  endPinch,
  fromCentre,
  movePinch,
  moveSingle,
  releaseSingle,
  type ViewerGestureContext,
} from './viewerModes';
import { animateZoom, readZoom, stopZoom } from './viewerValues';

export interface ViewerGestures {
  down: (event: PointerEvent) => void;
  move: (event: PointerEvent) => void;
  up: (event: PointerEvent) => void;
  dispose: () => void;
}

export function createViewerGestures(read: () => ViewerGestureContext): ViewerGestures {
  const state = createGestureState();
  let lastTap: Tap | null = null;
  let tapTimer: number | undefined;

  const handleTap = (ctx: ViewerGestureContext, tap: Tap) => {
    window.clearTimeout(tapTimer);
    if (isDoubleTap(lastTap, tap)) {
      lastTap = null;
      const point = fromCentre(ctx.viewport, tap);
      animateZoom(
        ctx.values,
        doubleTapZoom(readZoom(ctx.values), point, ctx.base, ctx.viewport),
        ctx.reducedMotion,
      );
      return;
    }
    lastTap = tap;
    // A single tap waits to be sure it is not the first half of a double tap.
    tapTimer = window.setTimeout(() => {
      lastTap = null;
      read().onToggleChrome();
    }, DOUBLE_TAP_MS);
  };

  const down = (event: PointerEvent) => {
    if (event.button > 0) return;
    const ctx = read();
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 2) return beginPinch(state, ctx);
    if (state.pointers.size > 2 || state.mode !== 'idle') return;
    stopZoom(ctx.values);
    ctx.values.track.stop();
    state.mode = 'pending';
    state.start = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    state.startZoom = readZoom(ctx.values);
    state.startTrack = ctx.values.track.get();
    state.tracker.reset();
    state.tracker.add(event.timeStamp, event.clientX, event.clientY);
  };

  const move = (event: PointerEvent) => {
    if (!state.pointers.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    state.pointers.set(event.pointerId, point);
    if (state.mode === 'pinch') return movePinch(state, read());
    if (state.mode === 'idle' || state.mode === 'blocked') return;
    state.tracker.add(event.timeStamp, point.x, point.y);
    moveSingle(state, read(), point);
  };

  const up = (event: PointerEvent) => {
    if (!state.pointers.delete(event.pointerId)) return;
    const ctx = read();
    if (state.mode === 'pinch') return endPinch(state, ctx);
    if (state.pointers.size > 0) return;
    const end = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    const tapped =
      state.mode === 'pending' && event.type === 'pointerup' && isTap(state.start, end);
    if (tapped) handleTap(ctx, end);
    else releaseSingle(state, ctx, end, state.tracker.velocity(event.timeStamp));
    state.mode = 'idle';
  };

  return { down, move, up, dispose: () => window.clearTimeout(tapTimer) };
}
