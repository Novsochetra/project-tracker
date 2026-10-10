import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { stripMetadata } from '../../src/images/stripMetadata';
import {
  CAMERA_EXIF,
  animatedWebp,
  containsText,
  pngChunk,
  rawImage,
  rawPixelsOf,
  screenPixels,
  withPngChunkAtEnd,
} from '../helpers/images';

// Reviewer 102 (PT-127 re-review): the byte-level strip of an image kept as it came dropped a PNG's
// eXIf with its orientation, kept an EXIF or comment between a progressive JPEG's scans, and kept
// chunks it didn't know, which can carry any text.
describe('the strip of an image kept as it came', () => {
  it('keeps which way is up when it drops a PNG eXIf', async () => {
    const png = new Uint8Array(
      await rawImage(screenPixels(40, 30), 40, 30)
        .withMetadata({ orientation: 6 })
        .withExifMerge(CAMERA_EXIF)
        .png()
        .toBuffer(),
    );
    expect((await sharp(png).metadata()).orientation).toBe(6);
    // As kept when too big to decode; compressImage would turn and re-encode one this small.
    const kept = stripMetadata(png, 'image/png', 6)!;
    expect(containsText(kept, 'iPhone 15 Pro')).toBe(false);
    expect((await sharp(kept).metadata()).orientation).toBe(6);
    expect((await rawPixelsOf(kept)).equals(await rawPixelsOf(png))).toBe(true);
  });

  it('drops an EXIF and a comment between the scans of a progressive JPEG', async () => {
    const jpeg = await rawImage(screenPixels(48, 32), 48, 32)
      .jpeg({ progressive: true })
      .toBuffer();
    const second = jpeg.indexOf(
      Buffer.from([0xff, 0xda]),
      jpeg.indexOf(Buffer.from([0xff, 0xda])) + 2,
    );
    const exif = Buffer.from('Exif\0\0iPhone 15 Pro', 'latin1');
    const comment = Buffer.from('Shot at 11.55N', 'latin1');
    const segment = (marker: number, data: Buffer) =>
      Buffer.concat([Buffer.from([0xff, marker, 0, data.length + 2]), data]);
    const tagged = new Uint8Array(
      Buffer.concat([
        jpeg.subarray(0, second),
        segment(0xe1, exif),
        segment(0xfe, comment),
        jpeg.subarray(second),
      ]),
    );
    const image = await compressImage(tagged, 'image/jpeg');
    expect(image.mimeType).toBe('image/jpeg');
    expect(containsText(image.bytes, 'iPhone 15 Pro')).toBe(false);
    expect(containsText(image.bytes, '11.55N')).toBe(false);
    expect((await rawPixelsOf(image.bytes)).equals(await rawPixelsOf(jpeg))).toBe(true);
  });

  it('drops PNG chunks it doesn’t know, and keeps transparency', async () => {
    const png = new Uint8Array(
      await sharp({ create: { width: 8, height: 8, channels: 4, background: '#ff000080' } })
        .png({ palette: true })
        .toBuffer(),
    );
    expect(containsText(png, 'tRNS')).toBe(true);
    const tagged = withPngChunkAtEnd(png, pngChunk('prVW', Buffer.from('Author: Sok, 11.55N')));
    const image = await compressImage(tagged, 'image/png');
    expect(containsText(image.bytes, '11.55N')).toBe(false);
    expect(containsText(image.bytes, 'tRNS')).toBe(true);
  });

  it('drops WebP chunks it doesn’t know, and keeps every frame', async () => {
    const animated = Buffer.from(await animatedWebp(false));
    const extra = Buffer.from('META\x12\0\0\0Author: Sok 11.55N', 'latin1');
    const body = Buffer.concat([animated.subarray(12), extra]);
    const header = Buffer.from(animated.subarray(0, 12));
    header.writeUInt32LE(body.length + 4, 4);
    const tagged = new Uint8Array(Buffer.concat([header, body]));
    const image = await compressImage(tagged, 'image/webp');
    expect(containsText(image.bytes, '11.55N')).toBe(false);
    expect((await sharp(image.bytes).metadata()).pages).toBe(2);
  });
});
