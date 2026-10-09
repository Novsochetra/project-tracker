import type { AttachmentMimeType } from '@tracker/shared';

// A 12 MP phone photo (4032×3024) becomes 2560×1920: sharp full screen on any phone and zoomed in
// on most. A pixel budget rather than a longest side gives every shape the same detail, so a
// panorama stays tall enough to see.
export const MAX_PHOTO_PIXELS = 2560 * 1920;

// Screenshots and drawings are encoded losslessly and keep every pixel up to a 4K screen's area
// (3840×2160: a phone's, an iPad's or a MacBook's screen fits), so small text stays sharp. Lossless
// WebP needs about 30 bytes a pixel while it encodes, so this also caps that at about 250 MB.
export const MAX_LOSSLESS_PIXELS = 3840 * 2160;

// A 15 MB PNG can claim billions of pixels; past this one isn't decoded at all and stays as it came.
export const MAX_INPUT_PIXELS = 100_000_000;

// WebP's usual photo quality: about a quarter smaller than JPEG at the same look.
export const PHOTO_QUALITY = 80;

// A new type and name, and for photos another lossy pass, are worth it only for a real saving.
const MIN_SAVING_RATIO = 0.1;
export const MIN_SAVING_BYTES = 16 * 1024;

export interface ImageFacts {
  width: number;
  height: number;
  pages: number;
  orientation: number;
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

// Null keeps the image as it came: an animation would lose its frames.
export function planImage(mimeType: AttachmentMimeType, facts: ImageFacts): ImagePlan | null {
  if (facts.pages > 1 || facts.width * facts.height > MAX_INPUT_PIXELS) return null;
  const lossless = LOSSLESS_SOURCES.has(mimeType);
  const budget = lossless ? MAX_LOSSLESS_PIXELS : MAX_PHOTO_PIXELS;
  const longSide = longSideWithin(facts.width, facts.height, budget);
  const mustReencode = longSide !== null || facts.hasMetadata || facts.orientation > 1;
  return { lossless, longSide, mustReencode };
}

export function isWorthStoring(originalBytes: number, encodedBytes: number): boolean {
  const saving = originalBytes - encodedBytes;
  return saving >= MIN_SAVING_BYTES && saving >= originalBytes * MIN_SAVING_RATIO;
}
