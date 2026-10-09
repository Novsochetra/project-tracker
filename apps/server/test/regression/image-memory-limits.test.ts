import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { MAX_PHOTO_PIXELS } from '../../src/images/imagePlan';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#7090b0' } });

const asBytes = async (image: Sharp) => new Uint8Array(await image.toBuffer());

// Reviewer 102 (PT-127): a progressive JPEG or an interlaced PNG is decoded whole, about 3 to 6
// bytes a pixel: 1.2 MB claiming 100 MP took 694 MB, and four at once 1.9 GB. Such an image is now
// decoded only up to 25 MP, and any image up to 50 MP: enough for a 48 MP iPhone photo.
describe('images that would take too much memory to decode', () => {
  it('keeps a progressive JPEG past 25 MP as it came', async () => {
    const photo = await asBytes(solid(6000, 4500).jpeg({ progressive: true }));
    const image = await compressImage(photo, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 6000, height: 4500 });
    expect(Buffer.from(image.bytes).equals(Buffer.from(photo))).toBe(true);
  });

  it('keeps an interlaced PNG past 25 MP as it came', async () => {
    const png = await asBytes(solid(6000, 4500).png({ progressive: true }));
    const image = await compressImage(png, 'image/png');
    expect(image).toMatchObject({ mimeType: 'image/png', width: 6000, height: 4500 });
  });

  it('keeps a JPEG past 50 MP as it came', async () => {
    const photo = await asBytes(solid(9000, 6000).jpeg());
    expect(await compressImage(photo, 'image/jpeg')).toMatchObject({
      mimeType: 'image/jpeg',
      width: 9000,
    });
  });

  it('still compresses a 48 MP iPhone photo', async () => {
    const photo = await asBytes(
      solid(8064, 6048)
        .withExif({ IFD0: { Model: 'iPhone 15 Pro' } })
        .jpeg(),
    );
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    expect(image.width! * image.height!).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);
  });

  it('still compresses a progressive JPEG up to 25 MP', async () => {
    const photo = await asBytes(
      solid(5000, 4000)
        .withExif({ IFD0: { Model: 'iPhone 15 Pro' } })
        .jpeg({ progressive: true }),
    );
    expect((await compressImage(photo, 'image/jpeg')).mimeType).toBe('image/webp');
  });
});
