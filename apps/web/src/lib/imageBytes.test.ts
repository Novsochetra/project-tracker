import { describe, expect, it } from 'vitest';
import { HEAD_BYTES, isJpegOrWebp } from './imageBytes';

const headOf = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part,
    ),
  );

describe('isJpegOrWebp', () => {
  it('knows a JPEG by its start marker and a WebP by its RIFF header', () => {
    expect(isJpegOrWebp(headOf([0xff, 0xd8, 0xff, 0xe1]))).toBe(true);
    expect(isJpegOrWebp(headOf('RIFF', [0x24, 0x10, 0, 0], 'WEBP'))).toBe(true);
  });

  it('turns down a HEIC, an AVIF, a TIFF, a PNG and a GIF, whatever they are named', () => {
    expect(isJpegOrWebp(headOf([0, 0, 0, 0x20], 'ftypheic'))).toBe(false);
    expect(isJpegOrWebp(headOf([0, 0, 0, 0x1c], 'ftypavif'))).toBe(false);
    expect(isJpegOrWebp(headOf('MM', [0, 0x2a]))).toBe(false);
    expect(isJpegOrWebp(headOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
    expect(isJpegOrWebp(headOf('GIF89a'))).toBe(false);
  });

  it('turns down a RIFF that is no WebP, and too few bytes', () => {
    expect(isJpegOrWebp(headOf('RIFF', [0, 0, 0, 0], 'WAVE'))).toBe(false);
    expect(isJpegOrWebp(headOf([0xff]))).toBe(false);
    expect(isJpegOrWebp(new Uint8Array(0))).toBe(false);
  });

  it('needs no more than the head the web app reads', () => {
    const webp = headOf('RIFF', [0x24, 0x10, 0, 0], 'WEBPVP8 ');
    expect(isJpegOrWebp(webp.subarray(0, HEAD_BYTES))).toBe(true);
  });
});
