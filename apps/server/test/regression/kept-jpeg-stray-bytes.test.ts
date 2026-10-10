import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { stripJpeg } from '../../src/images/stripJpeg';
import { noisyPixels, rawImage } from '../helpers/images';

// Reviewer 102 (PT-127 re-review): libjpeg skips stray bytes before a marker ("Corrupt JPEG data: 3
// extraneous bytes before marker 0xc0") and every viewer shows the picture. stripJpeg stopped at
// the first byte that isn't 0xFF and dropped everything after it, the image data too, so a JPEG
// kept as it came (small and lean, too big to decode, or not worth re-encoding) was stored broken.
async function withStrayBytes(): Promise<Uint8Array> {
  const jpeg = await rawImage(noisyPixels(64, 48), 64, 48).jpeg({ quality: 80 }).toBuffer();
  const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  return Buffer.concat([
    jpeg.subarray(0, sof),
    Buffer.from([0x12, 0x34, 0x56]),
    jpeg.subarray(sof),
  ]);
}

describe('a JPEG with stray bytes between its header segments', () => {
  it('still has its picture after stripJpeg', async () => {
    const jpeg = await withStrayBytes();
    const original = await sharp(jpeg, { failOn: 'none' }).raw().toBuffer();
    const stripped = stripJpeg(jpeg, 1)!;
    expect(await sharp(stripped, { failOn: 'none' }).raw().toBuffer()).toEqual(original);
  });

  it('is stored with its picture when it is kept as it came', async () => {
    const jpeg = await withStrayBytes();
    const image = await compressImage(jpeg, 'image/jpeg');
    const meta = await sharp(image.bytes, { failOn: 'none' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(meta.info).toMatchObject({ width: 64, height: 48 });
  });
});
