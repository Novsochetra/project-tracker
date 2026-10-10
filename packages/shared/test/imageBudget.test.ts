import { describe, expect, it } from 'vitest';
import {
  MAX_LOSSLESS_PIXELS,
  MAX_PHOTO_PIXELS,
  longSideWithin,
  sizeWithin,
} from '../src/domain/imageBudget';

describe('image budgets', () => {
  it('are a 4.9 MP photo and a 4K screen', () => {
    expect(MAX_PHOTO_PIXELS).toBe(2560 * 1920);
    expect(MAX_LOSSLESS_PIXELS).toBe(3840 * 2160);
  });
});

describe('longSideWithin', () => {
  it('leaves an image within the pixel budget alone, so nothing is ever enlarged', () => {
    expect(longSideWithin(2560, 1920, MAX_PHOTO_PIXELS)).toBeNull();
    expect(longSideWithin(300, 200, MAX_PHOTO_PIXELS)).toBeNull();
  });

  it('brings a 12 MP phone photo to 2560×1920', () => {
    expect(longSideWithin(4032, 3024, MAX_PHOTO_PIXELS)).toBe(2560);
    expect(longSideWithin(3024, 4032, MAX_PHOTO_PIXELS)).toBe(2560);
  });

  it('gives every shape the same budget, so a panorama stays tall enough to see', () => {
    const longSide = longSideWithin(16000, 3000, MAX_PHOTO_PIXELS)!;
    const shortSide = Math.round((3000 * longSide) / 16000);
    expect(longSide * shortSide).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);
    expect(shortSide).toBeGreaterThan(900);
  });
});

describe('sizeWithin', () => {
  it('keeps a size within the budget', () => {
    expect(sizeWithin(2560, 1920, MAX_PHOTO_PIXELS)).toEqual({ width: 2560, height: 1920 });
    expect(sizeWithin(1170, 2532, MAX_LOSSLESS_PIXELS)).toEqual({ width: 1170, height: 2532 });
  });

  it('brings a 12 MP phone photo, either way up, to 2560×1920', () => {
    expect(sizeWithin(4032, 3024, MAX_PHOTO_PIXELS)).toEqual({ width: 2560, height: 1920 });
    expect(sizeWithin(3024, 4032, MAX_PHOTO_PIXELS)).toEqual({ width: 1920, height: 2560 });
  });

  it('brings a 5K screenshot to 4K', () => {
    expect(sizeWithin(5120, 2880, MAX_LOSSLESS_PIXELS)).toEqual({ width: 3840, height: 2160 });
  });

  it('never comes out past the budget, so the server never shrinks it again', () => {
    for (const [width, height] of [
      [4288, 2848],
      [3000, 4001],
      [16000, 3000],
      [5713, 4284],
      [8064, 6048],
      [4033, 3025],
    ] as const) {
      const size = sizeWithin(width, height, MAX_PHOTO_PIXELS);
      expect(size.width * size.height).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);
      expect(longSideWithin(size.width, size.height, MAX_PHOTO_PIXELS)).toBeNull();
      expect(size.width * size.height).toBeGreaterThan(MAX_PHOTO_PIXELS * 0.99);
      expect(size.width / size.height).toBeCloseTo(width / height, 2);
    }
  });
});
