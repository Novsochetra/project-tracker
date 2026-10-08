import { describe, expect, it } from 'vitest';
import { isRecord } from './isRecord';

describe('isRecord', () => {
  it('takes objects and refuses null and other values', () => {
    expect(isRecord({ title: 'Crash' })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('title')).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});
