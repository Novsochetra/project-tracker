import { sniffImageType } from '@tracker/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { TINY_HEIC } from '../helpers/images';

const solid = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } });
const bytesOf = async (image: Promise<Buffer>) => new Uint8Array(await image);

describe('sniffImageType', () => {
  it('knows each image type by its bytes', async () => {
    expect(sniffImageType(await bytesOf(solid().jpeg().toBuffer()))).toBe('image/jpeg');
    expect(sniffImageType(await bytesOf(solid().png().toBuffer()))).toBe('image/png');
    expect(sniffImageType(await bytesOf(solid().webp().toBuffer()))).toBe('image/webp');
    expect(sniffImageType(await bytesOf(solid().gif().toBuffer()))).toBe('image/gif');
    expect(sniffImageType(TINY_HEIC)).toBe('image/heic');
    expect(sniffImageType(await bytesOf(solid().tiff().toBuffer()))).toBe('image/tiff');
  });

  it('knows a JPEG by its start marker alone, as libjpeg does', async () => {
    const jpeg = await bytesOf(solid().jpeg().toBuffer());
    const stray = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0x00]), jpeg.subarray(2)]);
    expect(sniffImageType(stray)).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0xff, 0xd9, 0xff]))).toBeNull();
  });

  it('knows nothing else', () => {
    for (const text of ['hello', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'RIFF1234AVI ', '']) {
      expect(sniffImageType(new TextEncoder().encode(text)), text).toBeNull();
    }
  });
});
