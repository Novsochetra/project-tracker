import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { stripJpeg } from '../../src/images/stripJpeg';
import { stripMetadata } from '../../src/images/stripMetadata';
import { stripPng } from '../../src/images/stripPng';
import { stripWebp } from '../../src/images/stripWebp';
import {
  animatedWebp,
  containsText,
  jpegPhoto,
  pngChunk,
  pngImage,
  rawPixelsOf,
  screenPixels,
  withJpegSegment,
  withPngChunkAtEnd,
} from '../helpers/images';

const metadataOf = (bytes: Uint8Array) => sharp(bytes).metadata();

describe('stripJpeg', () => {
  it('drops EXIF, XMP, IPTC and comments, and keeps every pixel', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    const marked = withJpegSegment(
      withJpegSegment(photo, 0xed, Buffer.from('Photoshop 3.0\0IPTC Phnom Penh')),
      0xfe,
      Buffer.from('taken by Sok'),
    );
    const stripped = stripJpeg(marked, 1)!;
    for (const text of ['iPhone 15 Pro', 'Phnom Penh', 'taken by Sok']) {
      expect(containsText(stripped, text), text).toBe(false);
    }
    const meta = await metadataOf(stripped);
    expect([meta.exif, meta.iptc, meta.xmp]).toEqual([undefined, undefined, undefined]);
    expect((await rawPixelsOf(stripped)).equals(await rawPixelsOf(photo))).toBe(true);
  });

  it('keeps the color profile and which way is up', async () => {
    const photo = new Uint8Array(
      await sharp({ create: { width: 40, height: 20, channels: 3, background: '#d03020' } })
        .withIccProfile('p3')
        .withExif({ IFD0: { Model: 'iPhone 15 Pro' } })
        .jpeg()
        .toBuffer(),
    );
    const stripped = stripJpeg(photo, 6)!;
    const meta = await metadataOf(stripped);
    expect(meta.icc).toBeDefined();
    expect(meta.orientation).toBe(6);
    expect(containsText(stripped, 'iPhone 15 Pro')).toBe(false);
  });

  it('drops what follows the image, where phones put more images and their metadata', async () => {
    const photo = await jpegPhoto({ width: 16, height: 16 });
    const trailer = Buffer.concat([Buffer.from(photo), Buffer.from('GPS 11.55N 104.92E')]);
    expect(Buffer.from(stripJpeg(trailer, 1)!).equals(Buffer.from(photo))).toBe(true);
  });

  it('keeps nothing past a header cut off before the image data', async () => {
    const photo = await jpegPhoto({ width: 16, height: 16, camera: true });
    const exifAt = Buffer.from(photo).indexOf(Buffer.from([0xff, 0xe1]));
    const cut = photo.subarray(0, exifAt + 40);
    expect(containsText(stripJpeg(cut, 1)!, 'Apple')).toBe(false);
  });

  it('leaves bytes that are not a JPEG to the caller', () => {
    expect(stripJpeg(new TextEncoder().encode('not a jpeg'), 1)).toBeNull();
  });
});

describe('stripPng', () => {
  it('drops text, EXIF and time chunks wherever they are, and keeps the image', async () => {
    const png = await pngImage(screenPixels(40, 30), 40, 30);
    const tagged = withPngChunkAtEnd(
      withPngChunkAtEnd(png, pngChunk('tEXt', Buffer.from('Author\0Sok', 'latin1'))),
      pngChunk('tIME', Buffer.from([7, 234, 10, 9, 12, 0, 0])),
    );
    const stripped = stripPng(tagged)!;
    expect(containsText(stripped, 'Sok')).toBe(false);
    expect(Buffer.from(stripped).equals(Buffer.from(png))).toBe(true);
  });

  it('drops anything after the end chunk', async () => {
    const png = await pngImage(screenPixels(8, 8), 8, 8);
    const trailer = Buffer.concat([Buffer.from(png), Buffer.from('GPS 11.55N')]);
    expect(Buffer.from(stripPng(trailer)!).equals(Buffer.from(png))).toBe(true);
  });

  it('leaves bytes that are not a PNG to the caller', () => {
    expect(stripPng(new TextEncoder().encode('not a png'))).toBeNull();
  });
});

describe('stripWebp', () => {
  it('drops EXIF and XMP and keeps every frame', async () => {
    const animated = await animatedWebp(true);
    const stripped = stripWebp(animated)!;
    expect(containsText(stripped, 'iPhone 15 Pro')).toBe(false);
    const meta = await metadataOf(stripped);
    expect(meta).toMatchObject({ format: 'webp', pages: 2, width: 32, height: 24 });
    expect(meta.exif).toBeUndefined();
  });

  it('leaves bytes that are not a WebP to the caller', () => {
    expect(stripWebp(new TextEncoder().encode('RIFF....AVI '))).toBeNull();
  });
});

describe('stripMetadata', () => {
  it('leaves other images and bytes it cannot read as they are', async () => {
    const gif = new Uint8Array(
      await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
        .gif()
        .toBuffer(),
    );
    expect(stripMetadata(gif, 'image/gif', 1)).toBe(gif);
    const broken = new TextEncoder().encode('not really a png');
    expect(stripMetadata(broken, 'image/png', 1)).toBe(broken);
  });
});
