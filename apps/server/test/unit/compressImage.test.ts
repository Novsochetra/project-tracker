import { crc32 } from 'node:zlib';
import { MAX_LOSSLESS_PIXELS, MAX_PHOTO_PIXELS } from '@tracker/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DECODES_HEIC, compressImage } from '../../src/images/compressImage';
import {
  BLUE,
  CAMERA_EXIF,
  RED,
  TINY_HEIC,
  containsText,
  isNear,
  jpegPhoto,
  noisyPixels,
  pixelAt,
  pngImage,
  rawImage,
  rawPixelsOf,
  screenPixels,
  withPngChunkAtEnd,
} from '../helpers/images';

const metadataOf = (bytes: Uint8Array) => sharp(bytes).metadata();

describe('compressImage', () => {
  it('stands a photo upright as its EXIF orientation says', async () => {
    // Orientation 6: the camera was turned, and the picture's left side belongs at the top.
    const photo = await jpegPhoto({ width: 40, height: 20, orientation: 6 });
    const image = await compressImage(photo, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 20, height: 40 });
    expect(isNear(await pixelAt(image.bytes, 10, 2), RED)).toBe(true);
    expect(isNear(await pixelAt(image.bytes, 10, 37), BLUE)).toBe(true);
    expect((await metadataOf(image.bytes)).orientation).toBeUndefined();
  });

  it('removes the GPS location and camera details', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    expect(containsText(photo, 'iPhone 15 Pro')).toBe(true);
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    const meta = await metadataOf(image.bytes);
    expect([meta.exif, meta.xmp, meta.iptc]).toEqual([undefined, undefined, undefined]);
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect(containsText(image.bytes, 'Apple')).toBe(false);
  });

  it('removes them even when the WebP comes out bigger than the photo', async () => {
    const pixels = noisyPixels(64, 64);
    const photo = await jpegPhoto({ width: 64, height: 64, pixels, quality: 30, camera: true });
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });

  it('brings a big photo down to the photo budget, keeping its shape', async () => {
    const photo = await jpegPhoto({ width: 6000, height: 4000 });
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.width! * image.height!).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);
    expect(image.width! / image.height!).toBeCloseTo(1.5, 2);
    expect(await metadataOf(image.bytes)).toMatchObject({
      format: 'webp',
      width: image.width,
      height: image.height,
    });
  });

  it('never enlarges a small photo', async () => {
    const photo = await jpegPhoto({ width: 300, height: 200, camera: true });
    expect(await compressImage(photo, 'image/jpeg')).toMatchObject({ width: 300, height: 200 });
  });

  it('stores a clean photo as WebP when that is clearly smaller', async () => {
    const pixels = noisyPixels(800, 600);
    const photo = await jpegPhoto({ width: 800, height: 600, pixels, quality: 95 });
    const image = await compressImage(photo, 'image/jpeg');
    expect(image.mimeType).toBe('image/webp');
    expect(image.bytes.byteLength).toBeLessThan(photo.byteLength * 0.9);
  });

  it('keeps a clean photo as it came when the WebP would not be smaller', async () => {
    const pixels = noisyPixels(64, 64);
    const photo = await jpegPhoto({ width: 64, height: 64, pixels, quality: 30 });
    const image = await compressImage(photo, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 64, height: 64 });
    expect(Buffer.from(image.bytes).equals(Buffer.from(photo))).toBe(true);
  });

  it('keeps every pixel of a screenshot, at full size', async () => {
    const pixels = screenPixels(1170, 2532);
    const shot = await pngImage(pixels, 1170, 2532, 1);
    const image = await compressImage(shot, 'image/png');
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 1170, height: 2532 });
    expect(image.bytes.byteLength).toBeLessThan(shot.byteLength / 2);
    expect((await rawPixelsOf(image.bytes)).equals(pixels)).toBe(true);
  });

  it('brings a screenshot past its budget down to it', async () => {
    const shot = new Uint8Array(
      await sharp({ create: { width: 6000, height: 4000, channels: 3, background: '#fff' } })
        .png()
        .withExif({ IFD0: { Software: 'Screenshot tool' } })
        .toBuffer(),
    );
    const image = await compressImage(shot, 'image/png');
    expect(image.mimeType).toBe('image/webp');
    expect(image.width! * image.height!).toBeLessThanOrEqual(MAX_LOSSLESS_PIXELS);
    expect(image.width! * image.height!).toBeGreaterThan(MAX_LOSSLESS_PIXELS * 0.99);
  });

  it('keeps a small clean image as it came', async () => {
    const png = await pngImage(screenPixels(40, 30), 40, 30);
    const image = await compressImage(png, 'image/png');
    expect(image).toMatchObject({ mimeType: 'image/png', width: 40, height: 30 });
    expect(Buffer.from(image.bytes).equals(Buffer.from(png))).toBe(true);
  });

  it('leaves GIFs as they came, since they may move', async () => {
    const gif = new Uint8Array(await rawImage(screenPixels(40, 30), 40, 30).gif().toBuffer());
    expect(await compressImage(gif, 'image/gif')).toEqual({
      bytes: gif,
      mimeType: 'image/gif',
      width: 40,
      height: 30,
    });
  });

  it.runIf(!DECODES_HEIC)('keeps a HEIC as it came where sharp has no HEVC decoder', async () => {
    expect(await compressImage(TINY_HEIC, 'image/heic')).toEqual({
      bytes: TINY_HEIC,
      mimeType: 'image/heic',
      width: 64,
      height: 48,
    });
  });

  it.runIf(DECODES_HEIC)('stores a HEIC as WebP where sharp can decode it', async () => {
    const image = await compressImage(TINY_HEIC, 'image/heic');
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 64, height: 48 });
  });

  it('keeps a file it cannot read as it came', async () => {
    const broken = new TextEncoder().encode('not really a png');
    expect(await compressImage(broken, 'image/png')).toEqual({
      bytes: broken,
      mimeType: 'image/png',
      width: null,
      height: null,
    });
  });

  it('does not decode an image claiming more pixels than it may', async () => {
    const header = Buffer.from(await pngImage(screenPixels(4, 4), 4, 4));
    header.writeUInt32BE(20_000, 16);
    header.writeUInt32BE(20_000, 20);
    header.writeUInt32BE(crc32(header.subarray(12, 29)), 29);
    const image = await compressImage(new Uint8Array(header), 'image/png');
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.bytes).equals(header)).toBe(true);
  });
});

// PT-134: the web app sends these as they are, trusting the server to drop their GPS location.
describe('what the web app sends as it is', () => {
  const GPS_ONLY = { IFD3: CAMERA_EXIF.IFD3 };

  // The camera's eXIf chunk as sharp writes it, to be put where readers that stop early miss it.
  async function cameraExifChunk(): Promise<Buffer> {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .png()
      .withExif(CAMERA_EXIF)
      .toBuffer();
    const at = png.indexOf('eXIf') - 4;
    return png.subarray(at, at + 12 + png.readUInt32BE(at));
  }

  it('stores a light photo within the budget as WebP at its size, without its GPS', async () => {
    const pixels = noisyPixels(2560, 1920);
    const photo = new Uint8Array(
      await rawImage(pixels, 2560, 1920).withExif(GPS_ONLY).jpeg({ quality: 80 }).toBuffer(),
    );
    expect(photo.byteLength).toBeLessThan(2 * 1024 * 1024);
    expect((await metadataOf(photo)).exif).toBeDefined();
    const image = await compressImage(photo, 'image/jpeg');
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 2560, height: 1920 });
    expect((await metadataOf(image.bytes)).exif).toBeUndefined();
  });

  it('stores a screenshot with an eXIf chunk lossless, every pixel kept, without it', async () => {
    const pixels = screenPixels(1170, 2532);
    const shot = new Uint8Array(
      await rawImage(pixels, 1170, 2532).png().withExif(CAMERA_EXIF).toBuffer(),
    );
    expect(containsText(shot, 'eXIf')).toBe(true);
    const image = await compressImage(shot, 'image/png');
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 1170, height: 2532 });
    expect((await metadataOf(image.bytes)).exif).toBeUndefined();
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect((await rawPixelsOf(image.bytes)).equals(pixels)).toBe(true);
  });

  it('drops an eXIf chunk after the pixels of a PNG too small to be worth a WebP', async () => {
    const tiny = await pngImage(screenPixels(40, 30), 40, 30);
    const tagged = withPngChunkAtEnd(tiny, await cameraExifChunk());
    expect(containsText(tagged, 'iPhone 15 Pro')).toBe(true);
    const image = await compressImage(tagged, 'image/png');
    expect(containsText(image.bytes, 'eXIf')).toBe(false);
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
  });
});
