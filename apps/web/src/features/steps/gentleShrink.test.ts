import { describe, expect, it } from 'vitest';
import { foldMotion, shrinkFrames } from './gentleShrink';

describe('shrinkFrames', () => {
  it('eases a list that got shorter from its old height to its new one', () => {
    expect(shrinkFrames(584, 182)).toEqual([{ height: '584px' }, { height: '182px' }]);
  });

  it('leaves a first measure, the same height and growth alone', () => {
    expect(shrinkFrames(null, 182)).toBeNull();
    expect(shrinkFrames(182, 182)).toBeNull();
    expect(shrinkFrames(182, 240)).toBeNull();
  });
});

describe('foldMotion', () => {
  const pxPerFrame = (px: number) => {
    const { duration } = foldMotion(px);
    return ((px / Number(duration)) * (1000 / 60)) / (1 - 0.4);
  };

  it('folds a few lines in the base time, ease-in', () => {
    expect(foldMotion(144)).toEqual({ duration: 240, easing: 'cubic-bezier(0.4, 0, 1, 1)' });
  });

  it('takes longer for a longer way, so no frame moves much more than 24px', () => {
    expect(pxPerFrame(144)).toBeLessThanOrEqual(24);
    expect(pxPerFrame(500)).toBeCloseTo(24);
    expect(foldMotion(500).duration).toBeGreaterThan(240);
  });

  it("stops at grow's length for a very long step", () => {
    expect(foldMotion(5_000).duration).toBe(700);
  });
});
