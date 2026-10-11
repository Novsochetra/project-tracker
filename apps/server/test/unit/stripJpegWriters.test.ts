import { describe, expect, it } from 'vitest';
import { jpegSegments } from '../../src/images/jpegSegments';
import { stripJpeg } from '../../src/images/stripJpeg';
import { JPEG_WRITERS, jpegFixture, rawPixelsOf } from '../helpers/images';

const APP0 = 0xe0;
const APP14 = 0xee;

function headersOf(bytes: Uint8Array): Buffer[] {
  const buffer = Buffer.from(bytes);
  return [...jpegSegments(buffer)]
    .filter(({ marker }) => marker === APP0 || marker === APP14)
    .map(({ start, end }) => buffer.subarray(start, end));
}

describe.each(JPEG_WRITERS)('a JPEG written by $writer', ({ file, metadata }) => {
  const jpeg = jpegFixture(file);

  it('keeps its JFIF or Adobe header byte for byte, and every pixel', async () => {
    const stripped = stripJpeg(jpeg, 1)!;
    expect(headersOf(jpeg)).toHaveLength(1);
    expect(headersOf(stripped)).toEqual(headersOf(jpeg));
    expect((await rawPixelsOf(stripped)).equals(await rawPixelsOf(jpeg))).toBe(true);
  });

  it.skipIf(metadata)('keeps every byte, having nothing but the picture', () => {
    expect(Buffer.from(stripJpeg(jpeg, 1)!).equals(jpeg)).toBe(true);
  });

  it('puts which way is up after JFIF, which wants to come first', () => {
    const [header] = headersOf(jpeg);
    const first = header![1] === APP0 ? header! : Buffer.alloc(0);
    const turned = Buffer.from(stripJpeg(jpeg, 6)!);
    expect(turned.subarray(2, 2 + first.length)).toEqual(first);
    expect(turned.subarray(2 + first.length, 4 + first.length)).toEqual(Buffer.from([0xff, 0xe1]));
  });
});
