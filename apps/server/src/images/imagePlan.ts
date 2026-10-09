import type { AttachmentMimeType } from '@tracker/shared';

const MB = 1024 * 1024;

// A 12 MP phone photo (4032×3024) becomes 2560×1920: sharp full screen on any phone and zoomed in
// on most. A pixel budget rather than a longest side gives every shape the same detail, so a
// panorama stays tall enough to see.
export const MAX_PHOTO_PIXELS = 2560 * 1920;

// Screenshots and drawings are encoded losslessly and keep every pixel up to a 4K screen's area
// (3840×2160: a phone's, an iPad's or a MacBook's screen fits), so small text stays sharp.
export const MAX_LOSSLESS_PIXELS = 3840 * 2160;

// Past these an image isn't decoded at all and is kept as it came (stripped of its metadata). A
// baseline JPEG or a plain PNG is decoded a strip at a time (a JPEG shrunk while it is read), so
// size costs time, not memory: 50 MP takes in a 48 MP iPhone photo (8064×6048). A progressive JPEG,
// an interlaced PNG, a WebP or a HEIF is decoded whole, up to 8 bytes a pixel, so 25 MP: a 24 MP
// photo (an iPhone's 5712×4284, a camera's 6000×4000) still fits.
export const MAX_INPUT_PIXELS = 50_000_000;
export const MAX_WHOLE_DECODE_PIXELS = 25_000_000;

// WebP's usual photo quality: about a quarter smaller than JPEG at the same look.
export const PHOTO_QUALITY = 80;

// A new type and name, and for photos another lossy pass, are worth it only for a real saving.
const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 16 * 1024;

// Upper bounds of what was measured with one libvips thread (docs/architecture.md): what libvips
// holds anyway, a whole decode at 2 bytes a channel, and per pixel that comes out, lossy WebP 4
// bytes and lossless 44 (29 for a screenshot, 43 for noise, its worst case).
const BASE_WORK_BYTES = 64 * MB;
const LOSSLESS_BYTES_PER_PIXEL = 44;
const LOSSY_BYTES_PER_PIXEL = 4;

export interface ImageFacts {
  width: number;
  height: number;
  pages: number;
  orientation: number;
  channels: number;
  decodedWhole: boolean;
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

export function longSideWithin(width: number, height: number, maxPixels: number): number | null {
  const pixels = width * height;
  if (pixels <= maxPixels) return null;
  return Math.floor(Math.max(width, height) * Math.sqrt(maxPixels / pixels));
}

const tooBigToDecode = ({ width, height, decodedWhole }: ImageFacts): boolean =>
  width * height > (decodedWhole ? MAX_WHOLE_DECODE_PIXELS : MAX_INPUT_PIXELS);

// Null keeps the image as it came: an animation would lose its frames.
export function planImage(mimeType: AttachmentMimeType, facts: ImageFacts): ImagePlan | null {
  if (facts.pages > 1 || tooBigToDecode(facts)) return null;
  const lossless = LOSSLESS_SOURCES.has(mimeType);
  const budget = lossless ? MAX_LOSSLESS_PIXELS : MAX_PHOTO_PIXELS;
  const longSide = longSideWithin(facts.width, facts.height, budget);
  const mustReencode = longSide !== null || facts.hasMetadata || facts.orientation > 1;
  return { lossless, longSide, mustReencode };
}

function outputPixels({ width, height }: ImageFacts, { longSide }: ImagePlan): number {
  if (longSide === null) return width * height;
  return longSide * Math.ceil((Math.min(width, height) * longSide) / Math.max(width, height));
}

// What encoding the image may hold in memory at most, so several are let in only while they fit.
export function workBytes(facts: ImageFacts, plan: ImagePlan): number {
  const decode = facts.decodedWhole ? facts.width * facts.height * facts.channels * 2 : 0;
  const perPixel = plan.lossless ? LOSSLESS_BYTES_PER_PIXEL : LOSSY_BYTES_PER_PIXEL;
  return BASE_WORK_BYTES + decode + outputPixels(facts, plan) * perPixel;
}

export function isWorthStoring(originalBytes: number, encodedBytes: number): boolean {
  const saving = originalBytes - encodedBytes;
  return saving >= MIN_SAVING_BYTES && saving >= originalBytes * MIN_SAVING_RATIO;
}
