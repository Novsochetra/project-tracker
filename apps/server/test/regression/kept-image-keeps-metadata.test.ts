import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import {
  animatedWebp,
  claimingJpegSize,
  containsText,
  jpegPhoto,
  pngChunk,
  pngImage,
  screenPixels,
  withJpegSegment,
  withPngChunkAtEnd,
} from '../helpers/images';

// Reviewer 102 (PT-127): an image the server keeps as it came (too big to decode, animated, or too
// small to be worth re-encoding) was stored with whatever it carried: GPS in its EXIF, a comment,
// PNG text after the image data.
describe('an image kept as it came', () => {
  it('loses its GPS and camera when it is too big to decode, and stays upright', async () => {
    const photo = await jpegPhoto({ width: 60, height: 40, camera: true, orientation: 6 });
    const huge = claimingJpegSize(photo, 9000, 6000);
    const image = await compressImage(huge, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 6000, height: 9000 });
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect(containsText(image.bytes, 'Apple')).toBe(false);
    expect((await sharp(image.bytes).metadata()).orientation).toBe(6);
  });

  it('loses a JPEG comment', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48 });
    const commented = withJpegSegment(photo, 0xfe, Buffer.from('Shot at 11.55N 104.92E'));
    const image = await compressImage(commented, 'image/jpeg');
    expect(image.mimeType).toBe('image/jpeg');
    expect(containsText(image.bytes, '11.55N')).toBe(false);
    expect((await sharp(image.bytes).metadata()).width).toBe(64);
  });

  it('loses PNG text, even after the image data', async () => {
    const png = await pngImage(screenPixels(40, 30), 40, 30);
    const text = pngChunk('tEXt', Buffer.from('Location\u000011.55N 104.92E', 'latin1'));
    const image = await compressImage(withPngChunkAtEnd(png, text), 'image/png');
    expect(image.mimeType).toBe('image/png');
    expect(containsText(image.bytes, '11.55N')).toBe(false);
    expect(Buffer.from(image.bytes).equals(Buffer.from(png))).toBe(true);
  });

  it('keeps an animated WebP moving, without its GPS', async () => {
    const animated = await animatedWebp(true);
    expect(containsText(animated, 'iPhone 15 Pro')).toBe(true);
    const image = await compressImage(animated, 'image/webp');
    expect(image.mimeType).toBe('image/webp');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    const meta = await sharp(image.bytes).metadata();
    expect(meta).toMatchObject({ pages: 2, width: 32 });
    expect(meta.exif).toBeUndefined();
  });
});
