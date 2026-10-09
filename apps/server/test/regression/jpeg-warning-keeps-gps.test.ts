import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { containsText, jpegPhoto } from '../helpers/images';

// Reviewer 102 (PT-127): libjpeg warns about bytes like these ("Corrupt JPEG data: 2 extraneous
// bytes before marker 0xda") in photos from some phones and editors, which every viewer shows.
// sharp's default failOn 'warning' made the encode throw, and the photo was stored as it came,
// with its GPS location and camera, uncompressed.
function withExtraneousBytes(jpeg: Uint8Array): Uint8Array {
  const bytes = Buffer.from(jpeg);
  const sos = bytes.indexOf(Buffer.from([0xff, 0xda]));
  return Buffer.concat([bytes.subarray(0, sos), Buffer.from([0x00, 0x01]), bytes.subarray(sos)]);
}

describe('a photo libjpeg only warns about', () => {
  it('is still compressed and loses its GPS location', async () => {
    const photo = withExtraneousBytes(await jpegPhoto({ width: 64, height: 48, camera: true }));
    expect(containsText(photo, 'iPhone 15 Pro')).toBe(true);
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });

  it('a truncated photo is compressed and loses its GPS location too', async () => {
    const whole = await jpegPhoto({ width: 640, height: 480, camera: true, quality: 95 });
    const photo = whole.subarray(0, Math.floor(whole.byteLength * 0.8));
    const image = await compressImage(photo, 'image/jpeg');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });
});
