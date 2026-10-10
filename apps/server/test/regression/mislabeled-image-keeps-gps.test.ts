import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { CAMERA_EXIF, containsText, jpegPhoto, rawImage, screenPixels } from '../helpers/images';

// Reviewer 102 (PT-127 re-review): a file whose name gives the wrong type (a JPEG saved as .png;
// browsers take the type from the name) is no longer decoded, since the detected format must match
// the declared one, and the byte-level strip picks its stripper by the declared type: it found no
// PNG and kept the JPEG with its GPS. f9368a7 stored it as a WebP without metadata.
describe('an image whose declared type is not what it is', () => {
  it('a JPEG sent as image/png loses its GPS location', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    const image = await compressImage(photo, 'image/png');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });

  it('a PNG sent as image/jpeg loses its GPS location', async () => {
    const png = new Uint8Array(
      await rawImage(screenPixels(64, 48), 64, 48).withExif(CAMERA_EXIF).png().toBuffer(),
    );
    expect(containsText(png, 'iPhone 15 Pro')).toBe(true);
    const image = await compressImage(png, 'image/jpeg');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect((await sharp(image.bytes).metadata()).width).toBe(64);
  });
});
