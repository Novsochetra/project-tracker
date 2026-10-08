import { describe, expect, it } from 'vitest';
import { isScrolledDown } from './scrolledDown';

describe('isScrolledDown', () => {
  it('is not while the reader is on the first part of the screen', () => {
    expect(isScrolledDown(0, 812)).toBe(false);
    expect(isScrolledDown(203, 812)).toBe(false);
  });

  it('is once they scroll down past a quarter of the screen', () => {
    expect(isScrolledDown(204, 812)).toBe(true);
    expect(isScrolledDown(3000, 812)).toBe(true);
  });
});
