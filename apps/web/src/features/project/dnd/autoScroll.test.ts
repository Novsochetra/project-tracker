import { describe, expect, it } from 'vitest';
import { autoScrollStep, edgeScrollStep, scrollAlong } from './autoScroll';

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

describe('edgeScrollStep', () => {
  const zones = { start: 72, end: 72 };

  it('scrolls toward the edge of a range the pointer is near', () => {
    expect(edgeScrollStep(262, 200, 1200, zones)).toBe(-2);
    expect(edgeScrollStep(1190, 200, 1200, zones)).toBe(13);
    expect(edgeScrollStep(700, 200, 1200, zones)).toBe(0);
  });

  it('keeps the full speed once the pointer leaves the range', () => {
    expect(edgeScrollStep(0, 200, 1200, zones)).toBe(-15);
    expect(edgeScrollStep(5000, 200, 1200, zones)).toBe(15);
  });
});

describe('scrollAlong', () => {
  const scroller = () => ({ scrollLeft: 0, scrollTop: 10 }) as HTMLElement;

  it('scrolls one axis and says it moved', () => {
    const element = scroller();
    expect(scrollAlong(element, 'x', 12)).toBe(true);
    expect(element.scrollLeft).toBe(12);
    expect(scrollAlong(element, 'y', -4)).toBe(true);
    expect(element.scrollTop).toBe(6);
  });

  it('reports no movement without a step or an element', () => {
    expect(scrollAlong(scroller(), 'x', 0)).toBe(false);
    expect(scrollAlong(null, 'y', 5)).toBe(false);
  });
});
