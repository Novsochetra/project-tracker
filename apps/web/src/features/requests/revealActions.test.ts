import { describe, expect, it } from 'vitest';
import { revealDistance } from './revealActions';

describe('revealDistance', () => {
  it('scrolls the buttons up above the footer that covers them, with a gap', () => {
    expect(revealDistance(700, 812, [640])).toBe(68);
  });

  it('scrolls them above the keyboard when it covers more than the footer', () => {
    expect(revealDistance(500, 420, [740])).toBe(88);
  });

  it('leaves buttons already in sight, and a cover moved off the screen', () => {
    expect(revealDistance(600, 812, [640])).toBe(0);
    expect(revealDistance(700, 812, [900])).toBe(0);
  });
});
