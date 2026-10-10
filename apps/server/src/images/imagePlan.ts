import {
  MAX_LOSSLESS_PIXELS,
  MAX_PHOTO_PIXELS,
  MAX_WHOLE_DECODE_PIXELS,
  longSideWithin,
  type AttachmentMimeType,
} from '@tracker/shared';

const MB = 1024 * 1024;

// Past these an image isn't decoded at all and is kept as it came (stripped of its metadata). A
// baseline JPEG or a plain PNG is decoded a strip at a time (a JPEG shrunk while it is read), so
// size costs time, not memory: 50 MP takes in a 48 MP iPhone photo (8064×6048). What is held whole
// (wholePixels), up to 8 bytes a pixel, is kept to 25 MP: a 24 MP photo (an iPhone's 5712×4284, a
// camera's 6000×4000) still fits.
export const MAX_INPUT_PIXELS = 50_000_000;

// libjpeg reads every scan of a JPEG before its first row comes out, and sharp checks its timeout
// only between rows, so nothing stops a JPEG made of scans: 950,000 empty ones in 14 MB ran 160 s
// (PT-127 review). Encoders write about 10 (libjpeg: 10 for color, 18 for CMYK), and 100 passes
// over a 25 MP picture held whole take well under a second.
export const MAX_JPEG_SCANS = 100;

// WebP's usual photo quality: about a quarter smaller than JPEG at the same look.
export const PHOTO_QUALITY = 80;

// A new type and name, and for photos another lossy pass, are worth it only for a real saving.
const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 16 * 1024;

// Upper bounds of what was measured with one libvips thread (docs/architecture.md): what libvips
// holds anyway, a whole decode at 2 bytes a channel, and per pixel that comes out, lossy WebP 4
// bytes and lossless 44 (29 for a screenshot, 43 for noise, its worst case).
const BASE_WORK_BYTES = 64 * MB;

// No image whose estimate passes this is decoded; it is kept as it came, stripped. A 4K screenshot
// made lossless (about 413 MB) still fits, a 25 MP interlaced 16-bit PNG (602 MB; 525 measured)
// doesn't. The lanes in compressImage hold at most this much big work at once.
export const MAX_WORK_BYTES = 450 * MB;
const LOSSLESS_BYTES_PER_PIXEL = 44;
const LOSSY_BYTES_PER_PIXEL = 4;

export interface ImageFacts {
  width: number;
  height: number;
  pages: number;
  orientation: number;
  channels: number;
  format: 'jpeg' | 'png' | 'webp' | 'heif';
  // A progressive JPEG or an interlaced PNG.
  progressive: boolean;
  scans: number | null;
  // EXIF, XMP, IPTC or text chunks: where a phone puts the place and the camera.
  hasMetadata: boolean;
}

export interface ImagePlan {
  lossless: boolean;
  longSide: number | null;
  // The original can't be kept, even when it is smaller: it has to turn, shrink or lose metadata.
  mustReencode: boolean;
}

const LOSSLESS_SOURCES: ReadonlySet<AttachmentMimeType> = new Set(['image/png']);

function outputPixels({ width, height }: ImageFacts, { longSide }: ImagePlan): number {
  if (longSide === null) return width * height;
  return longSide * Math.ceil((Math.min(width, height) * longSide) / Math.max(width, height));
}

// Pixels held whole while encoding. A progressive JPEG's coefficients, an interlaced PNG, a WebP
// and a HEIF are decoded whole; so is any picture turned a quarter (orientation 5 to 8), which a
// JPEG first shrinks while it is read, by up to 8 and to no less than 4 times what comes out.
export function wholePixels(facts: ImageFacts, plan: ImagePlan): number {
  const pixels = facts.width * facts.height;
  const readWhole = facts.progressive || facts.format === 'webp' || facts.format === 'heif';
  if (readWhole) return pixels;
  if (facts.orientation < 5) return 0;
  if (facts.format !== 'jpeg') return pixels;
  return Math.min(pixels, Math.max(4 * outputPixels(facts, plan), pixels / 64));
}

// Null leaves the image undecoded, kept as it came: an animation would lose its frames, and past
// the limits above a decode takes too long or too much memory.
export function planImage(mimeType: AttachmentMimeType, facts: ImageFacts): ImagePlan | null {
  if (facts.pages > 1 || (facts.scans ?? 0) > MAX_JPEG_SCANS) return null;
  if (facts.width * facts.height > MAX_INPUT_PIXELS) return null;
  const lossless = LOSSLESS_SOURCES.has(mimeType);
  const budget = lossless ? MAX_LOSSLESS_PIXELS : MAX_PHOTO_PIXELS;
  const longSide = longSideWithin(facts.width, facts.height, budget);
  const mustReencode = longSide !== null || facts.hasMetadata || facts.orientation > 1;
  const plan = { lossless, longSide, mustReencode };
  const tooBig = wholePixels(facts, plan) > MAX_WHOLE_DECODE_PIXELS;
  return tooBig || workBytes(facts, plan) > MAX_WORK_BYTES ? null : plan;
}

// What encoding the image may hold in memory at most, so several are let in only while they fit.
export function workBytes(facts: ImageFacts, plan: ImagePlan): number {
  const decode = wholePixels(facts, plan) * facts.channels * 2;
  const perPixel = plan.lossless ? LOSSLESS_BYTES_PER_PIXEL : LOSSY_BYTES_PER_PIXEL;
  return BASE_WORK_BYTES + decode + outputPixels(facts, plan) * perPixel;
}

export function isWorthStoring(originalBytes: number, encodedBytes: number): boolean {
  const saving = originalBytes - encodedBytes;
  return saving >= MIN_SAVING_BYTES && saving >= originalBytes * MIN_SAVING_RATIO;
}
