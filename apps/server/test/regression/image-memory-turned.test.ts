import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#7090b0' } });

// Reviewer 102 (PT-127 re-review): turning a picture a quarter (orientation 5 to 8) needs all of it
// in memory, so a 49.9 MP PNG turned took 265 MB though a PNG is otherwise read a strip at a time.
// A JPEG is shrunk while it is read, so only what is left is held: a 48 MP portrait photo is fine.
describe('a big image that has to be turned', () => {
  it('keeps a 49.9 MP PNG with orientation 6 as it came, never decoded', async () => {
    const png = new Uint8Array(
      await solid(8160, 6120).withMetadata({ orientation: 6 }).png().toBuffer(),
    );
    expect((await sharp(png).metadata()).orientation).toBe(6);
    const image = await compressImage(png, 'image/png');
    expect(image).toMatchObject({ mimeType: 'image/png', width: 6120, height: 8160 });
  });

  it('still compresses a 48 MP portrait iPhone photo', async () => {
    const photo = new Uint8Array(
      await solid(8064, 6048).withMetadata({ orientation: 6 }).jpeg().toBuffer(),
    );
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    expect(image.height).toBeGreaterThan(image.width!);
  });
});
