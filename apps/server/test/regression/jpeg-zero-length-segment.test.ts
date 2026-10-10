import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { claimingJpegSize, jpegPhoto, noisyPixels, rawImage } from '../helpers/images';

// Reviewer 124 (PT-127, PT-146): libjpeg reads an APP segment whose length field is 0 or 1 as empty
// and shows the picture. The strip kept such a segment's marker without its two length bytes, so
// the next marker was read as a length and the stored file showed nothing. The EXIF that keeps a
// kept photo upright was put between the marker and its length the same way.
const withEmptySegment = (jpeg: Uint8Array, marker: number, length: number) =>
  new Uint8Array(
    Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, marker, 0, length]), jpeg.subarray(2)]),
  );

const shown = (bytes: Uint8Array) =>
  sharp(bytes, { failOn: 'none' }).raw().toBuffer({ resolveWithObject: true });

describe('a JPEG with an APP segment whose length field is below 2', () => {
  for (const [marker, length] of [
    [0xe0, 0],
    [0xe0, 1],
    [0xee, 0],
  ] as const) {
    it(`APP${marker - 0xe0} of length ${length}: kept small and lean, still shows`, async () => {
      const plain = await rawImage(noisyPixels(64, 48), 64, 48).jpeg().toBuffer();
      const jpeg = withEmptySegment(plain, marker, length);
      expect((await shown(jpeg)).info.width).toBe(64);
      const image = await compressImage(jpeg, 'image/jpeg');
      expect(image.mimeType).toBe('image/jpeg');
      expect((await shown(image.bytes)).info).toMatchObject({ width: 64, height: 48 });
    });
  }

  it('first in a turned photo too big to decode: kept readable and upright', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, orientation: 6 });
    const jpeg = withEmptySegment(claimingJpegSize(photo, 9000, 6000), 0xe0, 0);
    const image = await compressImage(jpeg, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 6000, height: 9000 });
    const meta = await sharp(image.bytes, { failOn: 'none' }).metadata();
    expect(meta).toMatchObject({ width: 9000, height: 6000, orientation: 6 });
  });
});
