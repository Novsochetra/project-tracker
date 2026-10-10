import { MAX_LOSSLESS_PIXELS, type AttachmentMimeType } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { MAX_UNTOUCHED_PHOTO_BYTES, planImage } from './imagePlan';

const MB = 1024 * 1024;

const source = (type: AttachmentMimeType, width: number, height: number, bytes: number) => ({
  type,
  width,
  height,
  bytes,
});

const photoOf = (width: number, height: number) => ({ type: 'image/jpeg', width, height });
const pngOf = (width: number, height: number) => ({ type: 'image/png', width, height });

describe('planImage: photos', () => {
  it('sends a JPEG within the budget and under 2 MB as it is, for the server to strip', () => {
    expect(planImage(source('image/jpeg', 2560, 1920, MAX_UNTOUCHED_PHOTO_BYTES))).toBeNull();
    expect(planImage(source('image/jpeg', 1920, 2560, 900_000))).toBeNull();
    expect(planImage(source('image/webp', 1200, 800, 300_000))).toBeNull();
  });

  it('shrinks a 12 MP photo, either way up, to the server’s 4.9 MP budget', () => {
    expect(planImage(source('image/jpeg', 4032, 3024, 4 * MB))).toEqual({
      encodings: [photoOf(2560, 1920)],
      mustConvert: false,
    });
    expect(planImage(source('image/jpeg', 3024, 4032, 1.5 * MB))?.encodings).toEqual([
      photoOf(1920, 2560),
    ]);
  });

  it('shrinks a photo just past the budget, sent only if smaller, as the server shrinks it', () => {
    expect(planImage(source('image/jpeg', 2592, 1944, 239_000))).toEqual({
      encodings: [photoOf(2560, 1920)],
      mustConvert: false,
    });
    expect(planImage(source('image/webp', 2561, 1920, 200_000))).toEqual({
      encodings: [photoOf(2560, 1919)],
      mustConvert: false,
    });
  });

  it('always sends the JPEG of a photo past 25 MP, which the server may keep as it came', () => {
    expect(planImage(source('image/jpeg', 5712, 4284, 3 * MB))?.mustConvert).toBe(false);
    expect(planImage(source('image/jpeg', 6000, 4500, 3 * MB))).toEqual({
      encodings: [photoOf(2560, 1920)],
      mustConvert: true,
    });
  });

  it('re-encodes a heavy photo within the budget at its size, sent only if smaller', () => {
    expect(planImage(source('image/jpeg', 2400, 1600, MAX_UNTOUCHED_PHOTO_BYTES + 1))).toEqual({
      encodings: [photoOf(2400, 1600)],
      mustConvert: false,
    });
  });
});

describe('planImage: screenshots', () => {
  it('sends a PNG up to 8.3 MP and 15 MB as it is, so the server stores it lossless', () => {
    expect(planImage(source('image/png', 1290, 2796, 3 * MB))).toBeNull();
    expect(planImage(source('image/png', 3840, 2160, 15 * MB))).toBeNull();
    expect(planImage(source('image/png', 40, 30, 500))).toBeNull();
  });

  it('shrinks a PNG past 8.3 MP to 4K as a PNG, with a JPEG if that is still too heavy', () => {
    expect(planImage(source('image/png', 5120, 2880, 6 * MB))).toEqual({
      encodings: [pngOf(3840, 2160), photoOf(2956, 1662)],
      mustConvert: true,
    });
    const [png] = planImage(source('image/png', 6000, 4000, 30 * MB))!.encodings;
    expect(png!.width * png!.height).toBeLessThanOrEqual(MAX_LOSSLESS_PIXELS);
  });

  it('turns a PNG over 15 MB within 8.3 MP into a JPEG, as only that fits the limit', () => {
    expect(planImage(source('image/png', 3000, 2000, 15 * MB + 1))).toEqual({
      encodings: [photoOf(2715, 1810)],
      mustConvert: true,
    });
  });
});

describe('planImage: other types', () => {
  it('converts a HEIC the browser decodes to a JPEG within the budget, even a small one', () => {
    expect(planImage(source('image/heic', 1000, 750, 400_000))).toEqual({
      encodings: [photoOf(1000, 750)],
      mustConvert: true,
    });
    expect(planImage(source('image/heif', 4032, 3024, 3 * MB))?.encodings).toEqual([
      photoOf(2560, 1920),
    ]);
  });

  it('sends a GIF as it is, since it may move', () => {
    expect(planImage(source('image/gif', 4000, 4000, 14 * MB))).toBeNull();
  });
});
