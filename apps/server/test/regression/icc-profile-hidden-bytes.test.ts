import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { stripJpeg } from '../../src/images/stripJpeg';
import { stripWebp } from '../../src/images/stripWebp';
import {
  iccChunk,
  iccProfile,
  jpegWithProfile,
  webpWithProfile,
  withBytesAfterTags,
  withBytesBeforeTags,
  withTagPastEnd,
} from '../helpers/iccProfiles';
import { containsText, jpegPhoto, rawPixelsOf, withJpegSegment } from '../helpers/images';

// Seen in the PT-152 review: an APP2 ICC_PROFILE segment was kept whole (PT-146), so a crafted
// upload could hide anything in it. Only chunks that join into one well-formed profile stay.
const HIDDEN = Buffer.from('GPS 11.55N 104.92E', 'latin1');
const APP2 = 0xe2;

const withChunks = (jpeg: Uint8Array, chunks: Buffer[]) =>
  chunks.reduceRight((bytes, chunk) => withJpegSegment(bytes, APP2, chunk), jpeg);

async function expectProfileDropped(chunks: (srgb: Buffer) => Buffer[]) {
  const photo = await jpegPhoto({ width: 32, height: 24 });
  const stripped = stripJpeg(withChunks(photo, chunks(await iccProfile('srgb'))), 1)!;
  expect(containsText(stripped, 'GPS')).toBe(false);
  expect(Buffer.from(stripped).equals(Buffer.from(photo))).toBe(true);
}

describe('hidden bytes in a JPEG’s ICC profile', () => {
  it('drops a profile followed by more bytes in its segment', async () => {
    await expectProfileDropped((srgb) => [iccChunk(Buffer.concat([srgb, HIDDEN]), 1, 1)]);
  });

  it('drops a profile with bytes after its last tag', async () => {
    await expectProfileDropped((srgb) => [iccChunk(withBytesAfterTags(srgb, HIDDEN), 1, 1)]);
  });

  it('drops a profile with bytes between its tag table and its tags', async () => {
    await expectProfileDropped((srgb) => [iccChunk(withBytesBeforeTags(srgb, HIDDEN), 1, 1)]);
  });

  it('drops a profile whose tag runs past its end', async () => {
    await expectProfileDropped((srgb) => [iccChunk(withTagPastEnd(srgb), 1, 1)]);
  });

  it('drops an ICC segment that holds no profile', async () => {
    await expectProfileDropped(() => [iccChunk(HIDDEN, 1, 1)]);
  });

  it('drops every chunk when one more claims a place in the profile', async () => {
    await expectProfileDropped((srgb) => [iccChunk(srgb, 1, 1), iccChunk(HIDDEN, 2, 2)]);
  });

  it('drops every chunk when a whole profile comes twice', async () => {
    await expectProfileDropped((srgb) => [
      iccChunk(srgb, 1, 1),
      iccChunk(withBytesAfterTags(srgb, HIDDEN), 1, 1),
    ]);
  });

  it('drops chunks numbered twice the same', async () => {
    await expectProfileDropped((srgb) => [
      iccChunk(srgb.subarray(0, 200), 1, 2),
      iccChunk(srgb.subarray(200), 1, 2),
    ]);
  });

  it('drops chunks past the most a profile can have', async () => {
    await expectProfileDropped(() => Array.from({ length: 300 }, () => iccChunk(HIDDEN, 1, 1)));
  });

  it.each(['srgb', 'p3', 'cmyk'] as const)(
    'keeps a real %s profile byte for byte',
    async (name) => {
      const jpeg = await jpegWithProfile(name);
      expect(Buffer.from(stripJpeg(jpeg, 1)!).equals(jpeg)).toBe(true);
    },
  );

  it('keeps a profile whose chunks come out of order', async () => {
    const srgb = await iccProfile('srgb');
    const photo = await jpegPhoto({ width: 32, height: 24 });
    const chunks = [iccChunk(srgb.subarray(200), 2, 2), iccChunk(srgb.subarray(0, 200), 1, 2)];
    const jpeg = withChunks(photo, chunks);
    expect(Buffer.from(stripJpeg(jpeg, 1)!).equals(Buffer.from(jpeg))).toBe(true);
  });
});

const ICC_FLAG = 0x20;

function withIccpData(webp: Buffer, data: Buffer): Buffer {
  const at = webp.indexOf('ICCP', 12, 'latin1');
  const end = at + 8 + webp.readUInt32LE(at + 4);
  const chunk = Buffer.alloc(8 + data.length + (data.length % 2));
  chunk.write('ICCP', 0, 'latin1');
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);
  const bytes = Buffer.concat([webp.subarray(0, at), chunk, webp.subarray(end + (end % 2))]);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  return bytes;
}

describe('hidden bytes in a WebP’s ICC profile', () => {
  it('drops the profile and says there is none', async () => {
    const webp = await webpWithProfile('p3');
    const p3 = (await sharp(webp).metadata()).icc!;
    const stuffed = withIccpData(webp, withBytesAfterTags(p3, HIDDEN));
    const stripped = Buffer.from(stripWebp(stuffed)!);
    expect(containsText(stripped, 'GPS')).toBe(false);
    expect((await sharp(stripped).metadata()).icc).toBeUndefined();
    expect(stripped[20]! & ICC_FLAG).toBe(0);
    expect((await rawPixelsOf(stripped)).equals(await rawPixelsOf(webp))).toBe(true);
  });

  it('keeps a real profile byte for byte', async () => {
    const webp = await webpWithProfile('p3');
    expect(Buffer.from(stripWebp(webp)!).equals(webp)).toBe(true);
  });
});
