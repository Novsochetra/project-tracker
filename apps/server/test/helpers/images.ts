import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';

export const RED = [220, 30, 30] as const;
export const BLUE = [30, 30, 220] as const;

// What an iPhone writes into a photo, and what must not leave the server: where it was taken
// and with what.
export const CAMERA_EXIF = {
  IFD0: { Make: 'Apple', Model: 'iPhone 15 Pro' },
  IFD3: {
    GPSLatitudeRef: 'N',
    GPSLatitude: '11/1 33/1 0/1',
    GPSLongitudeRef: 'E',
    GPSLongitude: '104/1 55/1 0/1',
  },
};

export const TINY_HEIC = new Uint8Array(
  readFileSync(new URL('../fixtures/tiny.heic', import.meta.url)),
);

// Left half red, right half blue, so a turn shows in where the colors end up.
export function twoColorPixels(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = x < width / 2 ? RED : BLUE;
      pixels.set(color, (y * width + x) * 3);
    }
  }
  return pixels;
}

// Noise compresses about as badly as a photo's detail, so sizes behave like a camera's.
export function noisyPixels(width: number, height: number, seed = 1): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  let state = seed;
  for (let index = 0; index < pixels.length; index += 1) {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    pixels[index] = 96 + (state % 64) + (index % 97);
  }
  return pixels;
}

// Bands of flat color with thin lines, like an app's screen.
export function screenPixels(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const band = Math.floor(y / 90) % 4;
      const line = y % 90 < 3 || (x % 160 < 2 && band !== 0);
      const value = line ? 40 : 255 - band * 18;
      pixels.set([value, value, line ? 60 : 255], (y * width + x) * 3);
    }
  }
  return pixels;
}

export const rawImage = (pixels: Buffer, width: number, height: number) =>
  sharp(pixels, { raw: { width, height, channels: 3 } });

interface PhotoOptions {
  width: number;
  height: number;
  pixels?: Buffer;
  quality?: number;
  orientation?: number;
  camera?: boolean;
}

export async function jpegPhoto(options: PhotoOptions): Promise<Uint8Array> {
  const { width, height } = options;
  let image = rawImage(options.pixels ?? twoColorPixels(width, height), width, height);
  if (options.camera) image = image.withExif(CAMERA_EXIF);
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return new Uint8Array(await image.jpeg({ quality: options.quality ?? 90 }).toBuffer());
}

export const pngImage = async (pixels: Buffer, width: number, height: number, level = 6) =>
  new Uint8Array(await rawImage(pixels, width, height).png({ compressionLevel: level }).toBuffer());

export async function pixelAt(bytes: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [...data.subarray(offset, offset + 3)];
}

export const isNear = (actual: number[], expected: readonly number[]) =>
  actual.every((value, index) => Math.abs(value - expected[index]!) <= 40);

export async function rawPixelsOf(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes).removeAlpha().raw().toBuffer();
}

export const containsText = (bytes: Uint8Array, text: string) =>
  Buffer.from(bytes).includes(Buffer.from(text, 'latin1'));

// A JPEG segment (marker FF xx, then its length and data) put right after the start marker.
export function withJpegSegment(jpeg: Uint8Array, marker: number, data: Buffer): Uint8Array {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length + 2);
  const segment = Buffer.concat([Buffer.from([0xff, marker]), length, data]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

// Rewrites the size a JPEG's frame header claims, as a huge photo would, without its pixels.
export function claimingJpegSize(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const bytes = Buffer.from(jpeg);
  const frame = [0xc0, 0xc2].map((marker) => bytes.indexOf(Buffer.from([0xff, marker])));
  const start = Math.max(...frame);
  bytes.writeUInt16BE(height, start + 5);
  bytes.writeUInt16BE(width, start + 7);
  return bytes;
}

// EOB runs pass over blocks without data, so a scan of a few bytes still costs a pass over all.
function eobRuns(blocks: number): Buffer {
  let bits = '';
  let left = blocks;
  while (left >= 16384) {
    const run = Math.min(left, 32767);
    bits += '00' + (run - 16384).toString(2).padStart(14, '0');
    left -= run;
  }
  if (left > 0) bits += '01' + (left - 8192).toString(2).padStart(13, '0');
  bits = bits.padEnd(Math.ceil(bits.length / 8) * 8, '1');
  const data: number[] = [];
  for (let at = 0; at < bits.length; at += 8) {
    const byte = parseInt(bits.slice(at, at + 8), 2);
    data.push(...(byte === 0xff ? [0xff, 0x00] : [byte]));
  }
  return Buffer.from(data);
}

export async function scanFlood(scans: number, width = 2000, height = 1500): Promise<Uint8Array> {
  const base = await sharp({ create: { width, height, channels: 3, background: '#808080' } })
    .jpeg({ progressive: true, quality: 80 })
    .toBuffer();
  const eoi = base.lastIndexOf(Buffer.from([0xff, 0xd9]));
  const counts = Buffer.alloc(16);
  counts[1] = 2;
  const table = Buffer.concat([Buffer.from([0x11]), counts, Buffer.from([0xe0, 0xd0])]);
  const dht = Buffer.concat([Buffer.from([0xff, 0xc4, 0, table.length + 2]), table]);
  const sos = Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0x01, 1, 63, 0x00]);
  const scan = Buffer.concat([sos, eobRuns(Math.ceil(width / 8) * Math.ceil(height / 8))]);
  const flood = Buffer.concat(Array<Buffer>(scans).fill(scan));
  return Buffer.concat([base.subarray(0, eoi), dht, flood, Buffer.from([0xff, 0xd9])]);
}

export function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

// A chunk put just before IEND, after the image data, where readers that stop early miss it.
export function withPngChunkAtEnd(png: Uint8Array, chunk: Buffer): Uint8Array {
  const end = png.byteLength - 12;
  return Buffer.concat([png.subarray(0, end), chunk, png.subarray(end)]);
}

// Rewrites the size (and interlacing) a PNG's header claims, keeping its checksum right.
export function claimingPngSize(
  png: Uint8Array,
  width: number,
  height: number,
  interlaced = false,
): Uint8Array {
  const bytes = Buffer.from(png);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[28] = interlaced ? 1 : 0;
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  return bytes;
}

export async function animatedWebp(camera: boolean): Promise<Uint8Array> {
  const frame = (background: string) =>
    sharp({ create: { width: 32, height: 24, channels: 3, background } })
      .png()
      .toBuffer();
  let image = sharp([await frame('#d03020'), await frame('#2040d0')], {
    join: { animated: true },
  });
  if (camera) image = image.withExif(CAMERA_EXIF);
  return new Uint8Array(await image.webp({ loop: 0 }).toBuffer());
}
