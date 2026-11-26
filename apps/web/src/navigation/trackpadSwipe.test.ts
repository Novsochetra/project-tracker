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
  type TrackpadSwipe,
  type WheelStep,
} from './trackpadSwipe';

const yes = () => true;

function run(steps: WheelStep[], eligible = yes): TrackpadSwipe {
  return steps.reduce((swipe, step) => stepSwipe(swipe, step, eligible), IDLE_SWIPE);
}

describe('stepSwipe', () => {
  it('tracks a gesture whose first event is mostly sideways', () => {
    const swipe = run([
      { dx: -10, dy: 2, at: 0 },
      { dx: -30, dy: 5, at: 16 },
    ]);
    expect(swipe).toEqual({ phase: 'tracking', distance: -40, at: 16 });
  });

  it('ignores a gesture that starts vertical, even if it drifts sideways later', () => {
    const swipe = run([
      { dx: 2, dy: 10, at: 0 },
      { dx: -200, dy: 0, at: 16 },
    ]);
    expect(swipe.phase).toBe('ignored');
    expect(isSwipeComplete(swipe)).toBe(false);
  });

  it('ignores a sideways gesture over a place that is not eligible', () => {
    expect(run([{ dx: -50, dy: 0, at: 0 }], () => false).phase).toBe('ignored');
  });

  it('asks about eligibility only when a gesture starts', () => {
    let asked = 0;
    const eligible = () => {
      asked += 1;
      return true;
    };
    run(
      [
        { dx: -10, dy: 0, at: 0 },
        { dx: -10, dy: 0, at: 10 },
        { dx: -10, dy: 0, at: 20 },
      ],
      eligible,
    );
    expect(asked).toBe(1);
  });

  it('starts a new gesture after a pause', () => {
    const swipe = run([
      { dx: 2, dy: 10, at: 0 },
      { dx: -20, dy: 0, at: GESTURE_GAP_MS + 1 },
    ]);
    expect(swipe).toEqual({ phase: 'tracking', distance: -20, at: GESTURE_GAP_MS + 1 });
  });

  it('keeps a finished gesture finished through its momentum', () => {
    const done: TrackpadSwipe = { phase: 'done', distance: -200, at: 0 };
    const next = stepSwipe(done, { dx: -40, dy: 0, at: 10 }, yes);
    expect(next).toEqual({ phase: 'done', distance: -200, at: 10 });
    expect(ownsWheel(next)).toBe(true);
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
    const tracking = (distance: number): TrackpadSwipe => ({ phase: 'tracking', distance, at: 0 });
    expect(isSwipeComplete(tracking(-SWIPE_DISTANCE))).toBe(true);
    expect(isSwipeComplete(tracking(SWIPE_DISTANCE - 1))).toBe(false);
    expect(ownsWheel(IDLE_SWIPE)).toBe(false);
  });
});
