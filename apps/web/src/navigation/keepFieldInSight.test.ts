import { describe, expect, it } from 'vitest';
import { scrollAfterEditing, scrollToClearBar } from './keepFieldInSight';

// 375×812: the nav bar ends at 53, the bar starts at 743.
const VIEW = { top: 53, bottom: 812 };
const BAR = 69;

describe('scrollToClearBar', () => {
  it('is 0 for a field that ends at least 8px above the bar', () => {
    expect(scrollToClearBar({ top: 600, bottom: 735 }, VIEW, BAR)).toBe(0);
    expect(scrollToClearBar({ top: 100, bottom: 300 }, VIEW, BAR)).toBe(0);
  });

  it('scrolls a field the bar would cover until it ends 8px above the bar', () => {
    expect(scrollToClearBar({ top: 700, bottom: 760 }, VIEW, BAR)).toBe(25);
  });

  it('brings a form whose bottom runs past the screen fully above the bar', () => {
    expect(scrollToClearBar({ top: 690, bottom: 819 }, VIEW, BAR)).toBe(84);
  });

  it('scrolls a field that sits wholly under the bar', () => {
    expect(scrollToClearBar({ top: 760, bottom: 800 }, VIEW, BAR)).toBe(65);
  });

  it('rounds up, so no fraction of a pixel stays under the bar', () => {
    expect(scrollToClearBar({ top: 700, bottom: 735.4 }, VIEW, BAR)).toBe(1);
  });

  it('brings up a box that something pushed below the screen', () => {
    expect(scrollToClearBar({ top: 826, bottom: 955 }, VIEW, BAR)).toBe(220);
  });

  it('counts the safe area: a taller bar needs more room', () => {
    expect(scrollToClearBar({ top: 650, bottom: 735 }, VIEW, BAR + 34)).toBe(34);
  });

  it('leaves a field taller than the room between the nav bar and the bar where it is', () => {
    // 682px of room: 53 to 735.
    expect(scrollToClearBar({ top: 153.6, bottom: 932.9 }, VIEW, BAR)).toBe(0);
    expect(scrollToClearBar({ top: 100, bottom: 783 }, VIEW, BAR)).toBe(0);
  });

  it('brings up a field exactly as tall as the room, its top on the nav bar', () => {
    expect(scrollToClearBar({ top: 100, bottom: 782 }, VIEW, BAR)).toBe(47);
  });
});

describe('scrollAfterEditing', () => {
  it('brings the field that was edited above the bar', () => {
    expect(scrollAfterEditing({ top: 690, bottom: 819 }, VIEW, BAR)).toBe(84);
  });

  it('leaves a field scrolled below the screen alone; the bar does not come back over it', () => {
    expect(scrollAfterEditing({ top: 812, bottom: 900 }, VIEW, BAR)).toBe(0);
  });

  it('leaves a field too tall for the room where it is', () => {
    expect(scrollAfterEditing({ top: 153.6, bottom: 932.9 }, VIEW, BAR)).toBe(0);
  });
});
