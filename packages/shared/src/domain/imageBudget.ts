// The pixel budgets the server stores images within (apps/server/src/images/). The web app shrinks
// to the same budgets before uploading, so an image is never shrunk twice.

// A 12 MP phone photo (4032×3024) becomes 2560×1920: sharp full screen on any phone and zoomed in
// on most. A pixel budget rather than a longest side gives every shape the same detail, so a
// panorama stays tall enough to see.
export const MAX_PHOTO_PIXELS = 2560 * 1920;

// Screenshots and drawings are encoded losslessly and keep every pixel up to a 4K screen's area
// (3840×2160: a phone's, an iPad's or a MacBook's screen fits), so small text stays sharp.
export const MAX_LOSSLESS_PIXELS = 3840 * 2160;

export interface PixelSize {
  width: number;
  height: number;
}

export function longSideWithin(width: number, height: number, maxPixels: number): number | null {
  const pixels = width * height;
  if (pixels <= maxPixels) return null;
  return Math.floor(Math.max(width, height) * Math.sqrt(maxPixels / pixels));
}

// The short side is rounded down too, so the result is within the budget and the server, which
// shrinks only what is past it, keeps it at this size.
export function sizeWithin(width: number, height: number, maxPixels: number): PixelSize {
  const longSide = longSideWithin(width, height, maxPixels);
  if (longSide === null) return { width, height };
  const shortSide = Math.max(
    1,
    Math.floor((Math.min(width, height) * longSide) / Math.max(width, height)),
  );
  return width >= height
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}
