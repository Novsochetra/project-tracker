import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sniffImageType } from '../../src/images/sniffImage';
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

  it('knows nothing else', () => {
    for (const text of ['hello', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'RIFF1234AVI ', '']) {
      expect(sniffImageType(new TextEncoder().encode(text)), text).toBeNull();
    }
  });
});
