import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdToLift, LIFT_HOLD_MS, LIFT_SLOP, restsWithin } from './touchHold';

const press = { pointerId: 3, x: 100, y: 200 };

function pointer(type: string, clientX: number, clientY: number, pointerId = 3) {
  window.dispatchEvent(new PointerEvent(type, { pointerId, clientX, clientY }));
}

function hold() {
  const onLift = vi.fn();
  const onGiveUp = vi.fn();
  const giveUp = holdToLift(press, { onLift, onGiveUp });

  return { onLift, onGiveUp, giveUp };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('restsWithin', () => {
  it('lets a resting finger wander less than the slop, counted along both axes', () => {
    expect(restsWithin(press, { x: 104, y: 205 })).toBe(true);
    expect(restsWithin(press, { x: 100, y: 200 + LIFT_SLOP })).toBe(false);
    expect(restsWithin(press, { x: 95, y: 195 })).toBe(false);
  });
});

describe('holdToLift', () => {
  it('lifts where the finger rests once the hold is long enough', () => {
    const { onLift, onGiveUp } = hold();
    pointer('pointermove', 103, 204);
    vi.advanceTimersByTime(LIFT_HOLD_MS - 1);
    expect(onLift).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onLift).toHaveBeenCalledWith({ x: 103, y: 204 });
    pointer('pointerup', 103, 204);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it.each([
    ['moves past the slop', () => pointer('pointermove', 100, 230)],
    ['lifts', () => pointer('pointerup', 100, 200)],
    ['is taken for a scroll', () => pointer('pointercancel', 100, 200)],
  ])('gives up when the finger %s before the hold ends', (_name, act) => {
    const { onLift, onGiveUp } = hold();
    act();
    vi.advanceTimersByTime(LIFT_HOLD_MS);

    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onLift).not.toHaveBeenCalled();
  });

  it("ignores other fingers, and gives up when it's told to", () => {
    const { onLift, onGiveUp, giveUp } = hold();
    pointer('pointermove', 300, 600, 4);
    pointer('pointerup', 300, 600, 4);
    expect(onGiveUp).not.toHaveBeenCalled();

    giveUp();
    vi.advanceTimersByTime(LIFT_HOLD_MS);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onLift).not.toHaveBeenCalled();
  });
});
