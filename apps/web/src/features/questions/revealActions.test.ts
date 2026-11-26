import { describe, expect, it } from 'vitest';
import { revealDistance } from './revealActions';

describe('revealDistance', () => {
  it('scrolls the buttons up above the footer that covers them, with a gap', () => {
    expect(revealDistance(700, 812, [640])).toBe(68);
  });

  it('scrolls them above the keyboard when it covers more than the footer', () => {
    expect(revealDistance(500, 420, [740])).toBe(88);
  });

  it("keeps the top of what is taller than the room left in sight, under the screen's top", () => {
    expect(revealDistance(1300, 812, [740], 360.6)).toBe(360);
    expect(revealDistance(700, 812, [640], 500)).toBe(68);
    expect(revealDistance(1300, 812, [740], -20)).toBe(0);
  });

  it('leaves buttons already in sight, and a cover moved off the screen', () => {
    expect(revealDistance(600, 812, [640])).toBe(0);
    expect(revealDistance(700, 812, [900])).toBe(0);
  });
});
