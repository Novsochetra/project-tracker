import { describe, expect, it } from 'vitest';
import { wheelPixels } from './wheelPixels';

const wheel = (deltaY: number, deltaMode = 0) => ({
  deltaX: 0,
  deltaY,
  deltaMode,
  clientX: 40,
  clientY: 60,
});

describe('wheelPixels', () => {
  it('reads pixels as they are, lines as 16px and pages as the scroller', () => {
    expect(wheelPixels(wheel(100), 500)).toEqual({ x: 0, y: 100 });
    expect(wheelPixels(wheel(3, 1), 500)).toEqual({ x: 0, y: 48 });
    expect(wheelPixels(wheel(-1, 2), 500)).toEqual({ x: 0, y: -500 });
  });
});
