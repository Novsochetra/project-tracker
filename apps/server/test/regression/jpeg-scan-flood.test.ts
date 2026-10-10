import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compressImage } from '../../src/images/compressImage';
import { jpegPhoto, noisyPixels, scanFlood } from '../helpers/images';

// Reviewer 115 (PT-127): libjpeg reads every scan of a progressive JPEG before the first row comes
// out, and sharp checks its timeout only between rows, so the 30 s limit didn't stop a JPEG made of
// many empty scans. 250,000 of them (3.75 MB) ran 40 s, holding a photo lane and one of Node's 4
// thread-pool threads, which file reads and writes share.
describe('a progressive JPEG flooded with empty scans', () => {
  it('is kept as it came, without being decoded', async () => {
    const jpeg = await scanFlood(250_000);
    const started = Date.now();
    const image = await compressImage(jpeg, 'image/jpeg');
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(image).toMatchObject({ mimeType: 'image/jpeg', width: 2000, height: 1500 });
    expect(image.refusal).toBeUndefined();
  }, 180_000);

  it('does not hold up a photo sent after two of them', async () => {
    const flood = await scanFlood(250_000);
    const floods = [compressImage(flood, 'image/jpeg'), compressImage(flood, 'image/jpeg')];
    await new Promise((resolve) => setTimeout(resolve, 200));
    const photo = await jpegPhoto({
      width: 1600,
      height: 1200,
      pixels: noisyPixels(1600, 1200),
      camera: true,
    });
    const started = Date.now();
    await compressImage(photo, 'image/jpeg');
    const waited = Date.now() - started;
    await Promise.all(floods);
    expect(waited).toBeLessThan(5_000);
  }, 300_000);

  it('does not stall the server’s file reads while four of them run', async () => {
    // 3 MP ones go to the photo lane, two at a time; 4.1 MP ones (estimated 105 MB) to the big one.
    const small = await scanFlood(100_000);
    const big = await scanFlood(80_000, 2400, 1720);
    const floods = [small, small, big, big].map((flood) => compressImage(flood, 'image/jpeg'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const started = Date.now();
    await readFile(new URL('../../package.json', import.meta.url));
    const waited = Date.now() - started;
    await Promise.all(floods);
    expect(waited).toBeLessThan(2_000);
  }, 300_000);
});
