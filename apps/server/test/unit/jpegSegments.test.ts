import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { countJpegScans, jpegSegments } from '../../src/images/jpegSegments';
import { jpegPhoto, scanFlood, withJpegSegment } from '../helpers/images';

const solid = () =>
  sharp({ create: { width: 48, height: 32, channels: 3, background: '#4080c0' } });
const bytesOf = async (image: Promise<Buffer>) => new Uint8Array(await image);

describe('countJpegScans', () => {
  it('counts one scan in a baseline JPEG and a handful in a progressive one', async () => {
    expect(countJpegScans(await bytesOf(solid().jpeg().toBuffer()))).toBe(1);
    const progressive = countJpegScans(
      await bytesOf(solid().jpeg({ progressive: true }).toBuffer()),
    );
    expect(progressive).toBeGreaterThan(1);
    expect(progressive).toBeLessThan(20);
  });

  it('counts every empty scan added to a progressive JPEG', async () => {
    const base = countJpegScans(await scanFlood(0, 64, 48));
    expect(countJpegScans(await scanFlood(500, 64, 48))).toBe(base + 500);
  });

  it('counts only the scans libjpeg reads', async () => {
    const photo = await jpegPhoto({ width: 16, height: 16 });
    const lookalike = withJpegSegment(photo, 0xe1, Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0]));
    expect(countJpegScans(lookalike)).toBe(1);
    const trailer = Buffer.concat([photo, photo, photo]);
    expect(countJpegScans(trailer)).toBe(1);
    const stray = Buffer.concat([
      photo.subarray(0, 2),
      Buffer.from([0x00, 0x12]),
      photo.subarray(2),
    ]);
    expect(countJpegScans(stray)).toBe(1);
  });
});

describe('jpegSegments', () => {
  it('walks from the first segment to the end marker, a scan with its data', async () => {
    const photo = Buffer.from(await jpegPhoto({ width: 16, height: 16 }));
    const segments = [...jpegSegments(photo)];
    expect(segments[0]?.start).toBe(2);
    expect(segments.at(-1)).toEqual({ marker: 0xd9, start: photo.length - 2, end: photo.length });
    segments.slice(1).forEach((segment, index) => expect(segment.start).toBe(segments[index]!.end));
  });

  it('stops at a segment cut off', async () => {
    const photo = Buffer.from(await jpegPhoto({ width: 16, height: 16 }));
    const cut = photo.subarray(0, photo.indexOf(Buffer.from([0xff, 0xda])) + 3);
    expect([...jpegSegments(cut)].some(({ marker }) => marker === 0xda)).toBe(false);
  });
});
