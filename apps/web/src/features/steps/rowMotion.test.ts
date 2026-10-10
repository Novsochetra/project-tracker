import { describe, expect, it } from 'vitest';
import { foldMotion } from './rowMotion';

// Ease-in is steepest at its end, 1 / (1 - 0.4) times its mean speed.
const steepestPxPerFrame = (px: number) =>
  ((px / Number(foldMotion(px).duration)) * (1000 / 60)) / (1 - 0.4);

describe('foldMotion', () => {
  it('folds a few rows in the base time, ease-in', () => {
    expect(foldMotion(144)).toEqual({ duration: 240, easing: 'cubic-bezier(0.4, 0, 1, 1)' });
  });

  it('takes as long as it needs for no frame to move more than 24px, however far', () => {
    for (const px of [144, 500, 1_300, 3_000]) {
      expect(steepestPxPerFrame(px)).toBeLessThanOrEqual(24.001);
    }
    expect(foldMotion(1_300).duration).toBeCloseTo(1_505, 0);
  });
});
