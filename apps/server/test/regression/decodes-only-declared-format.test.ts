import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';

// Big enough to need shrinking, so a decode would show as a stored WebP.
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="4000">' +
    '<rect width="5000" height="4000" fill="#d03020"/></svg>',
);

// Reviewer 102 (PT-127): sharp reads what a file is, not what its type says, so an SVG sent as
// image/png was drawn by librsvg and stored as WebP. Only the declared format may be decoded.
describe('an image whose bytes are another format than its type says', () => {
  it('is never drawn: an SVG sent as PNG is kept as it came', async () => {
    const image = await compressImage(new Uint8Array(SVG), 'image/png');
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.bytes).equals(SVG)).toBe(true);
  });

  it('is never decoded: a TIFF sent as JPEG is kept as it came', async () => {
    const tiff = await sharp({
      create: { width: 6000, height: 4000, channels: 3, background: '#2040d0' },
    })
      .tiff({ compression: 'lzw' })
      .toBuffer();
    const image = await compressImage(new Uint8Array(tiff), 'image/jpeg');
    expect(image.mimeType).toBe('image/jpeg');
    expect(Buffer.from(image.bytes).equals(tiff)).toBe(true);
  });
});
