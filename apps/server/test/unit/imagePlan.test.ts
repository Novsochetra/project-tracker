import { MAX_LOSSLESS_PIXELS, MAX_PHOTO_PIXELS, longSideWithin } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { renamedFor } from '../../src/images/imageFileName';
import {
  MAX_INPUT_PIXELS,
  MAX_WHOLE_DECODE_PIXELS,
  MAX_WORK_BYTES,
  isWorthStoring,
  planImage,
  wholePixels,
  workBytes,
  type ImageFacts,
} from '../../src/images/imagePlan';

const facts = (overrides: Partial<ImageFacts> = {}): ImageFacts => ({
  width: 1000,
  height: 800,
  pages: 1,
  orientation: 1,
  channels: 3,
  format: 'jpeg',
  progressive: false,
  hasMetadata: false,
  ...overrides,
});

describe('planImage', () => {
  it('encodes photos lossy and PNGs (screenshots, drawings) losslessly', () => {
    expect(planImage('image/jpeg', facts())).toMatchObject({ lossless: false, longSide: null });
    expect(planImage('image/webp', facts())).toMatchObject({ lossless: false });
    expect(planImage('image/png', facts())).toMatchObject({ lossless: true, longSide: null });
  });

  it('gives screenshots a bigger budget than photos', () => {
    const shot = facts({ width: 3456, height: 2234 });
    expect(planImage('image/png', shot)?.longSide).toBeNull();
    expect(planImage('image/jpeg', shot)?.longSide).toBeLessThan(3456);
    const huge = facts({ width: 6000, height: 4000 });
    expect(longSideWithin(6000, 4000, MAX_LOSSLESS_PIXELS)).toBe(
      planImage('image/png', huge)?.longSide,
    );
  });

  it('must re-encode an image with metadata, a turn or too many pixels', () => {
    expect(planImage('image/jpeg', facts())?.mustReencode).toBe(false);
    expect(planImage('image/jpeg', facts({ hasMetadata: true }))?.mustReencode).toBe(true);
    expect(planImage('image/jpeg', facts({ orientation: 6 }))?.mustReencode).toBe(true);
    const big = facts({ width: 4032, height: 3024 });
    expect(planImage('image/jpeg', big)?.mustReencode).toBe(true);
  });

  it('leaves animations and images past the decoding limit as they came', () => {
    expect(planImage('image/webp', facts({ pages: 12 }))).toBeNull();
    expect(planImage('image/png', facts({ width: 20_000, height: 20_000 }))).toBeNull();
    expect(20_000 * 20_000).toBeGreaterThan(MAX_INPUT_PIXELS);
  });

  it('decodes a 48 MP iPhone photo, read a strip at a time', () => {
    expect(planImage('image/jpeg', facts({ width: 8064, height: 6048 }))).not.toBeNull();
  });

  it('decodes an image read whole only up to its smaller limit', () => {
    const whole = { progressive: true };
    expect(planImage('image/jpeg', facts({ ...whole, width: 5000, height: 4000 }))).not.toBeNull();
    expect(planImage('image/jpeg', facts({ ...whole, width: 6000, height: 4500 }))).toBeNull();
    expect(6000 * 4500).toBeGreaterThan(MAX_WHOLE_DECODE_PIXELS);
  });

  // Turning a quarter needs the whole picture; a JPEG holds only what is left after shrinking it.
  it('counts a turned picture as read whole, a JPEG after shrinking', () => {
    const turned = { orientation: 6, width: 8160, height: 6120 };
    expect(planImage('image/png', facts({ ...turned, format: 'png' }))).toBeNull();
    const photo = facts({ ...turned, format: 'jpeg' });
    const plan = planImage('image/jpeg', photo)!;
    expect(wholePixels(photo, plan)).toBeLessThanOrEqual(4 * MAX_PHOTO_PIXELS);
    expect(wholePixels(facts({ orientation: 3, format: 'png' }), plan)).toBe(0);
  });
});

describe('workBytes', () => {
  const MB = 1024 * 1024;
  const estimate = (mimeType: 'image/jpeg' | 'image/png', overrides: Partial<ImageFacts>) => {
    const image = facts(overrides);
    return workBytes(image, planImage(mimeType, image)!) / MB;
  };

  // Measured peaks (one libvips thread, docs/architecture.md) stay under the estimates.
  it('covers what measured images took', () => {
    expect(estimate('image/jpeg', { width: 4032, height: 3024 })).toBeGreaterThan(58);
    expect(estimate('image/jpeg', { width: 8064, height: 6048 })).toBeGreaterThan(58);
    const progressive = { width: 5712, height: 4284, progressive: true };
    expect(estimate('image/jpeg', progressive)).toBeGreaterThan(117);
    expect(estimate('image/png', { width: 3456, height: 2234 })).toBeGreaterThan(224);
  });

  it('counts a whole decode by its pixels and a lossless encode by what comes out', () => {
    const plain = estimate('image/png', { width: 3000, height: 2000 });
    const interlaced = estimate('image/png', { width: 3000, height: 2000, progressive: true });
    expect(interlaced - plain).toBeCloseTo((3000 * 2000 * 3 * 2) / MB, 0);
    const capped = estimate('image/png', { width: 4000, height: 3000 });
    expect(estimate('image/png', { width: 8000, height: 6000 })).toBeCloseTo(capped, -1);
  });

  it('leaves an image estimated past the most one may take undecoded', () => {
    const big = facts({ width: 5770, height: 4315, channels: 4, progressive: true, format: 'png' });
    expect(planImage('image/png', big)).toBeNull();
    const screenshot = facts({ width: 3840, height: 2160, format: 'png' });
    expect(workBytes(screenshot, planImage('image/png', screenshot)!)).toBeLessThanOrEqual(
      MAX_WORK_BYTES,
    );
  });
});

describe('isWorthStoring', () => {
  it('takes the re-encoded file only when it is clearly smaller', () => {
    expect(isWorthStoring(3_000_000, 800_000)).toBe(true);
    expect(isWorthStoring(3_000_000, 2_900_000)).toBe(false);
    expect(isWorthStoring(20_000, 10_000)).toBe(false);
    expect(isWorthStoring(855, 1570)).toBe(false);
  });
});

describe('renamedFor', () => {
  it('gives the name the stored type’s extension', () => {
    expect(renamedFor('IMG_0042.JPG', 'image/jpeg', 'image/webp')).toBe('IMG_0042.webp');
    expect(renamedFor('shot.png', 'image/png', 'image/webp')).toBe('shot.webp');
    expect(renamedFor('IMG_0042.HEIC', 'image/jpeg', 'image/webp')).toBe('IMG_0042.webp');
  });

  it('adds the extension to a name without an image one', () => {
    expect(renamedFor('photo', 'image/jpeg', 'image/webp')).toBe('photo.webp');
    expect(renamedFor('notes.v2', 'image/png', 'image/webp')).toBe('notes.v2.webp');
  });

  it('keeps the name when the type stays, or when there is none', () => {
    expect(renamedFor('shot.png', 'image/png', 'image/png')).toBe('shot.png');
    expect(renamedFor('  ', 'image/jpeg', 'image/webp')).toBe('  ');
  });
});
