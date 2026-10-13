import { describe, expect, it } from 'vitest';
import { descriptionText, riseDelay } from './projectRows';

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
