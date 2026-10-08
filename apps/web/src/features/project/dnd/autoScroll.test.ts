import { describe, expect, it } from 'vitest';
import { autoScrollStep } from './autoScroll';

describe('autoScrollStep', () => {
  it('does nothing away from the edges', () => {
    expect(autoScrollStep(400, 800, false)).toBe(0);
    expect(autoScrollStep(72, 800, false)).toBe(0);
    expect(autoScrollStep(760, 800, false)).toBe(0);
  });

  it('scrolls up within 72px of the top, faster further in', () => {
    expect(autoScrollStep(71, 800, false)).toBe(-1);
    expect(autoScrollStep(52, 800, false)).toBe(-4);
    expect(autoScrollStep(0, 800, true)).toBe(-15);
  });

  it('scrolls down within 40px of the bottom on desktop', () => {
    expect(autoScrollStep(761, 800, false)).toBe(1);
    expect(autoScrollStep(800, 800, false)).toBe(8);
  });

  it('uses a 96px bottom zone on phones, above the bottom bar', () => {
    expect(autoScrollStep(716, 812, true)).toBe(0);
    expect(autoScrollStep(717, 812, true)).toBe(1);
    expect(autoScrollStep(812, 812, true)).toBe(20);
  });
});
