import { describe, expect, it } from 'vitest';
import { descriptionText, progressPercent, riseDelay } from './projectRows';

describe('progressPercent', () => {
  it('rounds done over total', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
    expect(progressPercent(4, 4)).toBe(100);
  });

  it('is 0 for a project without tickets', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });
});

describe('riseDelay', () => {
  it('staggers rows by 24ms and stops after 12 rows', () => {
    expect(riseDelay(0)).toBe(0);
    expect(riseDelay(1)).toBe(24);
    expect(riseDelay(12)).toBe(288);
    expect(riseDelay(40)).toBe(288);
  });
});

describe('descriptionText', () => {
  it('falls back to "No description"', () => {
    expect(descriptionText('Marketing site')).toBe('Marketing site');
    expect(descriptionText('  ')).toBe('No description');
  });
});
