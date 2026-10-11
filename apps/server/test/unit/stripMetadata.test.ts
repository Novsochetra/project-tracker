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
  noisyPixels,
  pngChunk,
  pngImage,
  rawImage,
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

  it('keeps every byte of a JPEG without metadata, whatever its kind', async () => {
    const noise = () => rawImage(noisyPixels(48, 32), 48, 32);
    const kinds = [
      noise().jpeg(),
      noise().jpeg({ progressive: true }),
      noise().jpeg({ mozjpeg: true }),
      noise().jpeg({ chromaSubsampling: '4:4:4' }),
      noise().greyscale().jpeg({ progressive: true }),
      noise().toColourspace('cmyk').jpeg({ progressive: true }),
      noise().withIccProfile('p3').jpeg(),
    ];
    for (const kind of kinds) {
      const jpeg = await kind.toBuffer();
      expect(Buffer.from(stripJpeg(jpeg, 1)!).equals(jpeg)).toBe(true);
    }
  });

  it('drops segments of markers libjpeg doesn’t know, which can carry anything', async () => {
    const photo = await jpegPhoto({ width: 32, height: 24 });
    const marked = [0x02, 0xbf, 0xc8, 0xde, 0xf0, 0xfd].reduce(
      (jpeg, marker) => withJpegSegment(jpeg, marker, Buffer.from('GPS 11.55N 104.92E')),
      photo,
    );
    expect(Buffer.from(stripJpeg(marked, 1)!).equals(Buffer.from(photo))).toBe(true);
  });

  it('gives nothing for a JPEG cut off before its image data', async () => {
    const photo = await jpegPhoto({ width: 16, height: 16, camera: true });
    const exifAt = Buffer.from(photo).indexOf(Buffer.from([0xff, 0xe1]));
    expect(stripJpeg(photo.subarray(0, exifAt + 40), 1)).toBeNull();
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
    const stripped = stripPng(tagged, 1)!;
    expect(containsText(stripped, 'Sok')).toBe(false);
    expect(Buffer.from(stripped).equals(Buffer.from(png))).toBe(true);
  });

  it('drops anything after the end chunk', async () => {
    const png = await pngImage(screenPixels(8, 8), 8, 8);
    const trailer = Buffer.concat([Buffer.from(png), Buffer.from('GPS 11.55N')]);
    expect(Buffer.from(stripPng(trailer, 1)!).equals(Buffer.from(png))).toBe(true);
  });

  it('leaves bytes that are not a PNG to the caller', () => {
    expect(stripPng(new TextEncoder().encode('not a png'), 1)).toBeNull();
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

  it('reads the upload without changing it', async () => {
    const animated = await animatedWebp(true);
    const upload = Buffer.from(animated);
    stripWebp(animated);
    expect(Buffer.from(animated).equals(upload)).toBe(true);
  });

  it('leaves bytes that are not a WebP to the caller', () => {
    expect(stripWebp(new TextEncoder().encode('RIFF....AVI '))).toBeNull();
  });
});

describe('stripMetadata', () => {
  it('leaves other images as they are, and gives nothing for a PNG that isn’t one', async () => {
    const gif = new Uint8Array(
      await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
        .gif()
        .toBuffer(),
    );
    expect(stripMetadata(gif, 'image/gif', 1)).toBe(gif);
    const broken = new TextEncoder().encode('not really a png');
    expect(stripMetadata(broken, 'image/png', 1)).toBeNull();
  });
});
