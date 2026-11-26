export type SwipeDirection = 'back' | 'forward';

export interface WheelStep {
  dx: number;
  dy: number;
  at: number;
}

export interface TrackpadSwipe {
  phase: 'idle' | 'tracking' | 'ignored' | 'done';
  distance: number;
  at: number;
}

export const IDLE_SWIPE: TrackpadSwipe = { phase: 'idle', distance: 0, at: -Infinity };

// A trackpad keeps sending wheel events while the fingers move and through the momentum after
// they lift, a few milliseconds apart; a longer gap means a new gesture.
export const GESTURE_GAP_MS = 180;
export const SWIPE_DISTANCE = 140;

// The first event decides the whole gesture, like the browser's own swipe: a mostly vertical
// scroll that drifts sideways never turns into a page change.
export function stepSwipe(
  swipe: TrackpadSwipe,
  wheel: WheelStep,
  eligible: () => boolean,
): TrackpadSwipe {
  if (wheel.at - swipe.at > GESTURE_GAP_MS) {
    const horizontal = Math.abs(wheel.dx) > Math.abs(wheel.dy) && eligible();
    return horizontal
      ? { phase: 'tracking', distance: wheel.dx, at: wheel.at }
      : { phase: 'ignored', distance: 0, at: wheel.at };
  }
  if (swipe.phase !== 'tracking') return { ...swipe, at: wheel.at };
  return { ...swipe, distance: swipe.distance + wheel.dx, at: wheel.at };
}

// With macOS's natural scrolling, fingers moving right scroll left: negative deltas mean back.
export const swipeDirection = (distance: number): SwipeDirection | null =>
  distance < 0 ? 'back' : distance > 0 ? 'forward' : null;

export const swipeProgress = (distance: number): number =>
  Math.min(Math.abs(distance) / SWIPE_DISTANCE, 1);

export const isSwipeComplete = (swipe: TrackpadSwipe): boolean =>
  swipe.phase === 'tracking' && Math.abs(swipe.distance) >= SWIPE_DISTANCE;

export const ownsWheel = (swipe: TrackpadSwipe): boolean =>
  swipe.phase === 'tracking' || swipe.phase === 'done';
