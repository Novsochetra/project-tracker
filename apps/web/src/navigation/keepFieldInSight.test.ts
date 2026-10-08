import { describe, expect, it } from 'vitest';
import { scrollToClearBar } from './keepFieldInSight';

const SCREEN_BOTTOM = 812;
const BAR = 69;

describe('scrollToClearBar', () => {
  it('is 0 for a field that ends at least 8px above the bar', () => {
    expect(scrollToClearBar({ top: 600, bottom: 735 }, SCREEN_BOTTOM, BAR)).toBe(0);
    expect(scrollToClearBar({ top: 100, bottom: 300 }, SCREEN_BOTTOM, BAR)).toBe(0);
  });

  it('scrolls a field the bar would cover until it ends 8px above the bar', () => {
    expect(scrollToClearBar({ top: 700, bottom: 760 }, SCREEN_BOTTOM, BAR)).toBe(25);
  });

  it('brings a form whose bottom runs past the screen fully above the bar', () => {
    expect(scrollToClearBar({ top: 690, bottom: 819 }, SCREEN_BOTTOM, BAR)).toBe(84);
  });

  it('scrolls a field that sits wholly under the bar', () => {
    expect(scrollToClearBar({ top: 760, bottom: 800 }, SCREEN_BOTTOM, BAR)).toBe(65);
  });

  it('rounds up, so no fraction of a pixel stays under the bar', () => {
    expect(scrollToClearBar({ top: 700, bottom: 735.4 }, SCREEN_BOTTOM, BAR)).toBe(1);
  });

  it('leaves a field below the screen alone; the bar does not come back over it', () => {
    expect(scrollToClearBar({ top: 812, bottom: 900 }, SCREEN_BOTTOM, BAR)).toBe(0);
  });

  it('counts the safe area: a taller bar needs more room', () => {
    expect(scrollToClearBar({ top: 650, bottom: 735 }, SCREEN_BOTTOM, BAR + 34)).toBe(34);
  });
});
