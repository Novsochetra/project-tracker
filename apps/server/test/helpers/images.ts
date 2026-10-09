import { readFileSync } from 'node:fs';
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
