import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { claimingJpegSize, containsText, jpegPhoto } from '../helpers/images';

// Reviewer 115 (PT-127): libjpeg needs only FF D8 at the start and skips a stray byte after it
// ("Corrupt JPEG data: 1 extraneous bytes before marker 0xe1"), but sniffImageType wanted FF D8 FF.
// Such a JPEG wasn't recognized, fell back to its declared type and was kept with its GPS.
const strayAfterStart = (jpeg: Uint8Array) =>
  new Uint8Array(Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0x00]), jpeg.subarray(2)]));

const gpsPhoto = () => jpegPhoto({ width: 64, height: 48, camera: true });

describe('a JPEG with a stray byte right after its start marker', () => {
  it('still decodes, since libjpeg skips the byte', async () => {
    const jpeg = strayAfterStart(await gpsPhoto());
    const { info } = await sharp(jpeg, { failOn: 'none' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 64, height: 48 });
  });

  it('sent as image/png (a JPEG saved as .png) loses its GPS and camera', async () => {
    const image = await compressImage(strayAfterStart(await gpsPhoto()), 'image/png');
    expect(image.refusal).toBeUndefined();
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });

  it('kept as it came (too big to decode) loses its GPS and camera, and still shows', async () => {
    const jpeg = strayAfterStart(claimingJpegSize(await gpsPhoto(), 9000, 6000));
    const image = await compressImage(jpeg, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 9000, height: 6000 });
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect((await sharp(image.bytes, { failOn: 'none' }).metadata()).width).toBe(9000);
  });
});
