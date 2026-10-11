import type { JpegSegment } from './jpegSegments';

export const APP0 = 0xe0;
const APP14 = 0xee;

// libjpeg reads only these fields, and ignores a segment shorter than them: JFIF's version,
// density and thumbnail size, and Adobe's version, flags and color transform. What comes after
// (a thumbnail, Photoshop's scan table, anything at all) never reaches a pixel.
const HEADERS = new Map([
  [APP0, { name: Buffer.from('JFIF\0', 'latin1'), size: 14 }],
  [APP14, { name: Buffer.from('Adobe', 'latin1'), size: 12 }],
]);

// Cut from the upload rather than rebuilt, so a real file's header comes out byte for byte the same.
export function appHeader(bytes: Buffer, { marker, start, end }: JpegSegment): Buffer | null {
  const header = HEADERS.get(marker);
  const data = bytes.subarray(start + 4, end);
  if (!header || data.length < header.size || !data.subarray(0, 5).equals(header.name)) {
    return null;
  }
  const segment = Buffer.from(bytes.subarray(start, start + 4 + header.size));
  segment.writeUInt16BE(2 + header.size, 2);
  // A thumbnail size with no thumbnail after it would send a reader past the segment's end.
  if (marker === APP0) segment.fill(0, segment.length - 2);
  return segment;
}
