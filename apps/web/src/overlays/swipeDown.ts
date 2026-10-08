import { lockAxis } from '../gestures/math';
import { VelocityTracker } from '../gestures/velocity';
import type { Size } from '../gestures/zoomMath';
import { shouldDismissViewer, TAP_SLOP, type Tap } from './viewerMath';
import { moveDismiss } from './viewerModes';
import { resetDismiss, type ViewerValues } from './viewerValues';

export interface SwipeDownContext {
  values: ViewerValues;
  viewport: Size;
  reducedMotion: boolean;
  onDismiss: (velocityY: number) => void;
}

export interface SwipeDown {
  down: (event: PointerEvent) => void;
  move: (event: PointerEvent) => void;
  up: (event: PointerEvent) => void;
}

// For a viewer whose content handles its own touches, like a video's native controls: a drag is
// taken only once it is clearly downward, so taps and sideways scrubs reach the content untouched.
export function createSwipeDown(read: () => SwipeDownContext): SwipeDown {
  const tracker = new VelocityTracker();
  let pointerId: number | null = null;
  let start: Tap = { x: 0, y: 0, t: 0 };
  let dismissing = false;

  const down = (event: PointerEvent) => {
    if (event.button > 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    start = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    dismissing = false;
    tracker.reset();
    tracker.add(event.timeStamp, event.clientX, event.clientY);
  };

  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    tracker.add(event.timeStamp, event.clientX, event.clientY);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dismissing) {
      const axis = lockAxis(dx, dy, TAP_SLOP);
      if (axis === null) return;
      if (axis === 'x' || dy < 0) {
        pointerId = null;
        return;
      }
      dismissing = true;
      const target = event.currentTarget;
      if (target instanceof Element && typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(event.pointerId);
      }
    }
    moveDismiss(read(), dx, dy);
  };

  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (!dismissing) return;
    const ctx = read();
    const dy = event.clientY - start.y;
    const velocity = tracker.velocity(event.timeStamp);
    const released = event.type === 'pointerup';
    if (released && shouldDismissViewer(dy, velocity.y, ctx.viewport.height)) {
      ctx.onDismiss(velocity.y);
    } else resetDismiss(ctx.values, ctx.reducedMotion);
  };

  return { down, move, up };
}
