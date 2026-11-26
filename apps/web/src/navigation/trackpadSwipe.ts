export type SwipeDirection = 'back' | 'forward';

export interface WheelStep {
  dx: number;
  dy: number;
  at: number;
}

export interface TrackpadSwipe {
  phase: 'idle' | 'undecided' | 'tracking' | 'vertical' | 'refused' | 'done';
  dx: number;
  dy: number;
  at: number;
}

export const IDLE_SWIPE: TrackpadSwipe = { phase: 'idle', dx: 0, dy: 0, at: -Infinity };

// A trackpad keeps sending wheel events while the fingers move and through the momentum after
// they lift, a few milliseconds apart; a longer gap means a new gesture.
export const GESTURE_GAP_MS = 120;
export const SWIPE_DISTANCE = 140;
// A gesture's first event can be a pixel or two either way; it is decided once it has moved.
const DECIDE_PX = 2;
// A sideways swipe started while a vertical scroll still coasts: its events are far more sideways
// than a vertical scroll's drift.
const SIDEWAYS_RATIO = 3;

export type CanTrack = (direction: SwipeDirection) => boolean;

const isSideways = (dx: number, dy: number) => Math.abs(dx) > Math.abs(dy);

function decide(dx: number, dy: number, at: number, canTrack: CanTrack): TrackpadSwipe {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return { phase: 'undecided', dx, dy, at };
  if (!isSideways(dx, dy)) return { phase: 'vertical', dx: 0, dy: 0, at };
  const phase = canTrack(dx < 0 ? 'back' : 'forward') ? 'tracking' : 'refused';
  return { phase, dx: phase === 'tracking' ? dx : 0, dy: 0, at };
}

function startsOver(swipe: TrackpadSwipe, { dx, dy, at }: WheelStep): boolean {
  if (at - swipe.at > GESTURE_GAP_MS) return true;
  if (swipe.phase === 'done') return !isSideways(dx, dy);
  if (swipe.phase === 'vertical') {
    return Math.abs(dx) >= DECIDE_PX && Math.abs(dx) > SIDEWAYS_RATIO * Math.abs(dy);
  }
  return false;
}

// A gesture is decided as a whole, like the browser's own swipe: a vertical scroll that drifts
// sideways never turns into a page change.
export function stepSwipe(
  swipe: TrackpadSwipe,
  wheel: WheelStep,
  canTrack: CanTrack,
): TrackpadSwipe {
  if (startsOver(swipe, wheel)) return decide(wheel.dx, wheel.dy, wheel.at, canTrack);
  if (swipe.phase === 'undecided') {
    return decide(swipe.dx + wheel.dx, swipe.dy + wheel.dy, wheel.at, canTrack);
  }
  if (swipe.phase === 'tracking') return { ...swipe, dx: swipe.dx + wheel.dx, at: wheel.at };
  return { ...swipe, at: wheel.at };
}

// With macOS's natural scrolling, fingers moving right scroll left: negative deltas mean back.
export const swipeDirection = (dx: number): SwipeDirection | null =>
  dx < 0 ? 'back' : dx > 0 ? 'forward' : null;

export const swipeProgress = (dx: number): number => Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1);

export const isSwipeComplete = (swipe: TrackpadSwipe): boolean =>
  swipe.phase === 'tracking' && Math.abs(swipe.dx) >= SWIPE_DISTANCE;

// Chrome lets a page cancel a scroll's events only if it cancelled the first one, so an undecided
// gesture that may turn sideways holds on to its events too.
export function ownsWheel({ phase, dx, dy }: TrackpadSwipe): boolean {
  if (phase === 'undecided') return Math.abs(dx) >= Math.abs(dy);
  return phase === 'tracking' || phase === 'done';
}
