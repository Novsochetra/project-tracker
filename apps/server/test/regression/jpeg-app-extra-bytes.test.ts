import { describe, expect, it } from 'vitest';
import { stripJpeg } from '../../src/images/stripJpeg';
import {
  containsText,
  jpegFixture,
  noisyPixels,
  rawImage,
  withJpegSegment,
} from '../helpers/images';

// Reviewer 135 (PT-146): JFIF (APP0) and Adobe (APP14) segments were kept whole, so a writer could
// hide anything after their standard fields: a JFIF thumbnail, bytes past it, or past Adobe's color
// transform. libjpeg reads only those fields, so the rest can go without a pixel changing.
const HIDDEN = Buffer.from('GPS 11.55N 104.92E', 'latin1');
const JFIF = 0xe0;
const ADOBE = 0xee;

function withExtraBytes(jpeg: Buffer, marker: number, extra: Buffer): Buffer {
  const at = jpeg.indexOf(Buffer.from([0xff, marker]));
  const end = at + 2 + jpeg.readUInt16BE(at + 2);
  const stuffed = Buffer.concat([jpeg.subarray(0, end), extra, jpeg.subarray(end)]);
  stuffed.writeUInt16BE(end - at - 2 + extra.length, at + 2);
  return stuffed;
}

// Seven free bytes in each header's fields: repeated, they spell out anything.
function withRepeatedHeaders(jpeg: Buffer, marker: number, name: string, tail: number[]): Buffer {
  const at = jpeg.indexOf(Buffer.from([0xff, marker]));
  const end = at + 2 + jpeg.readUInt16BE(at + 2);
  const repeats = ['GPS 11.', '55N 104', '.92E   '].map((part) => {
    const data = Buffer.concat([Buffer.from(name + part, 'latin1'), Buffer.from(tail)]);
    return Buffer.concat([Buffer.from([0xff, marker, 0, data.length + 2]), data]);
  });
  return Buffer.concat([jpeg.subarray(0, end), ...repeats, jpeg.subarray(end)]);
}

const jfifJpeg = () => jpegFixture('pillow.jpg');
const adobeJpeg = () =>
  rawImage(noisyPixels(32, 24), 32, 24).toColourspace('cmyk').jpeg().toBuffer();

function expectStrippedBackTo(stuffed: Uint8Array, original: Buffer) {
  const stripped = stripJpeg(stuffed, 1)!;
  expect(containsText(stripped, 'GPS')).toBe(false);
  expect(Buffer.from(stripped).equals(original)).toBe(true);
}

describe('extra bytes in a JPEG’s JFIF and Adobe segments', () => {
  it('drops a JFIF thumbnail', () => {
    const stuffed = withExtraBytes(jfifJpeg(), JFIF, HIDDEN);
    const thumbnailSize = stuffed.indexOf(Buffer.from([0xff, JFIF])) + 16;
    stuffed.set([6, 1], thumbnailSize);
    expectStrippedBackTo(stuffed, jfifJpeg());
  });

  it('drops bytes after the JFIF header', () => {
    expectStrippedBackTo(withExtraBytes(jfifJpeg(), JFIF, HIDDEN), jfifJpeg());
  });

  it('drops a JFIF extension, which holds only a thumbnail', () => {
    const extension = Buffer.concat([Buffer.from('JFXX\0\x10', 'latin1'), HIDDEN]);
    expectStrippedBackTo(withJpegSegment(jfifJpeg(), JFIF, extension), jfifJpeg());
  });

  it('drops an APP0 that isn’t JFIF', () => {
    expectStrippedBackTo(withJpegSegment(jfifJpeg(), JFIF, HIDDEN), jfifJpeg());
  });

  it('drops bytes after Adobe’s color transform', async () => {
    const original = await adobeJpeg();
    expectStrippedBackTo(withExtraBytes(original, ADOBE, HIDDEN), original);
  });

  it('drops the scan table Photoshop puts there, which no longer points right', async () => {
    const original = await adobeJpeg();
    const scans = Buffer.from('03001003020306' + '00'.repeat(12), 'hex');
    expect(Buffer.from(stripJpeg(withExtraBytes(original, ADOBE, scans), 1)!)).toEqual(original);
  });

  it('keeps only the first JFIF header', () => {
    const repeated = withRepeatedHeaders(jfifJpeg(), JFIF, 'JFIF\0', [0, 0]);
    expectStrippedBackTo(repeated, jfifJpeg());
  });

  it('keeps only the first Adobe header', async () => {
    const original = await adobeJpeg();
    expectStrippedBackTo(withRepeatedHeaders(original, ADOBE, 'Adobe', []), original);
  });

  it('drops an APP14 that isn’t Adobe’s', async () => {
    const original = await adobeJpeg();
    expectStrippedBackTo(withJpegSegment(original, ADOBE, HIDDEN), original);
  });
});
