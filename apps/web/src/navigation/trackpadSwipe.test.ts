import { describe, expect, it } from 'vitest';
import {
  GESTURE_GAP_MS,
  IDLE_SWIPE,
  isSwipeComplete,
  ownsWheel,
  stepSwipe,
  SWIPE_DISTANCE,
  swipeDirection,
  swipeProgress,
  type CanTrack,
  type TrackpadSwipe,
  type WheelStep,
} from './trackpadSwipe';

const yes: CanTrack = () => true;

function run(steps: WheelStep[], canTrack = yes, from = IDLE_SWIPE): TrackpadSwipe {
  return steps.reduce<TrackpadSwipe>((swipe, step) => stepSwipe(swipe, step, canTrack), from);
}

const tracking = (dx: number, at = 0): TrackpadSwipe => ({ phase: 'tracking', dx, dy: 0, at });

describe('stepSwipe', () => {
  it('tracks a gesture that starts mostly sideways', () => {
    const swipe = run([
      { dx: -10, dy: 2, at: 0 },
      { dx: -30, dy: 5, at: 16 },
    ]);
    expect(swipe).toEqual(tracking(-40, 16));
  });

  it('keeps a vertical scroll vertical when it drifts sideways', () => {
    const swipe = run([
      { dx: 2, dy: 10, at: 0 },
      { dx: -20, dy: 10, at: 16 },
      { dx: -30, dy: 12, at: 32 },
    ]);
    expect(swipe.phase).toBe('vertical');
  });

  it('starts a swipe made while a vertical scroll still coasts', () => {
    const swipe = run([
      { dx: 0, dy: 40, at: 0 },
      { dx: 0, dy: 10, at: 16 },
      { dx: -30, dy: 2, at: 32 },
    ]);
    expect(swipe).toEqual(tracking(-30, 32));
  });

  it('waits for a tiny first event to move before deciding', () => {
    const first = run([{ dx: -1, dy: 1, at: 0 }]);
    expect(first.phase).toBe('undecided');
    expect(ownsWheel(first)).toBe(true);
    expect(run([{ dx: -4, dy: 1, at: 16 }], yes, first)).toEqual(tracking(-5, 16));
    expect(run([{ dx: 0, dy: 4, at: 16 }], yes, first).phase).toBe('vertical');
  });

  it('lets go of a tiny first event that leans vertical', () => {
    expect(ownsWheel(run([{ dx: 0, dy: 1, at: 0 }]))).toBe(false);
  });

  it('refuses a swipe that cannot be tracked that way, and asks only once', () => {
    const asked: string[] = [];
    const canTrack: CanTrack = (direction) => {
      asked.push(direction);
      return false;
    };
    const swipe = run(
      [
        { dx: -10, dy: 0, at: 0 },
        { dx: -10, dy: 0, at: 10 },
      ],
      canTrack,
    );
    expect(swipe.phase).toBe('refused');
    expect(ownsWheel(swipe)).toBe(false);
    expect(asked).toEqual(['back']);
  });

  it('starts a new gesture after a pause', () => {
    const swipe = run([
      { dx: 2, dy: 10, at: 0 },
      { dx: 20, dy: 0, at: GESTURE_GAP_MS + 1 },
    ]);
    expect(swipe).toEqual(tracking(20, GESTURE_GAP_MS + 1));
  });

  it('keeps a finished swipe finished through its momentum', () => {
    const done: TrackpadSwipe = { phase: 'done', dx: -200, dy: 0, at: 0 };
    const next = stepSwipe(done, { dx: -40, dy: 0, at: 10 }, yes);
    expect(next).toEqual({ ...done, at: 10 });
    expect(ownsWheel(next)).toBe(true);
  });

  it('lets a vertical scroll go at once after a finished swipe', () => {
    const done: TrackpadSwipe = { phase: 'done', dx: -200, dy: 0, at: 0 };
    const next = stepSwipe(done, { dx: -1, dy: 20, at: 10 }, yes);
    expect(next.phase).toBe('vertical');
    expect(ownsWheel(next)).toBe(false);
  });
});

describe('swipe results', () => {
  it('reads negative distance as back and positive as forward', () => {
    expect(swipeDirection(-5)).toBe('back');
    expect(swipeDirection(5)).toBe('forward');
    expect(swipeDirection(0)).toBeNull();
  });

  it('caps progress at 1', () => {
    expect(swipeProgress(-SWIPE_DISTANCE / 2)).toBe(0.5);
    expect(swipeProgress(SWIPE_DISTANCE * 3)).toBe(1);
  });

  it('completes once the distance is reached', () => {
    expect(isSwipeComplete(tracking(-SWIPE_DISTANCE))).toBe(true);
    expect(isSwipeComplete(tracking(SWIPE_DISTANCE - 1))).toBe(false);
    expect(ownsWheel(IDLE_SWIPE)).toBe(false);
  });
});
