import { describe, expect, it } from 'vitest';
import { earlierLabel, notKeptText, stepsLabel } from './stepCopy';

describe('step copy', () => {
  it('counts steps for the folded toggle', () => {
    expect(stepsLabel(1)).toBe('1 step');
    expect(stepsLabel(23)).toBe('23 steps');
  });

  it('counts the earlier steps a live list hides', () => {
    expect(earlierLabel(1)).toBe('1 earlier step');
    expect(earlierLabel(12)).toBe('12 earlier steps');
  });

  it('says how many of the oldest steps the tracker let go', () => {
    expect(notKeptText(1)).toBe('1 earlier step was not kept.');
    expect(notKeptText(120)).toBe('120 earlier steps were not kept.');
  });
});
