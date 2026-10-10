import { hasOrientation, orientationExif } from './exifOrientation';
import { jpegSegments, type JpegSegment } from './jpegSegments';

const SOI = 0xd8;
const SOS = 0xda;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

// Kept: JFIF (APP0), the color profile (APP2 ICC_PROFILE) and Adobe's color transform (APP14),
// which the pixels need. Dropped, wherever they are, between scans too: every other APPn (EXIF with
// GPS and camera, XMP, IPTC, MPF) and comments.
function isNeeded(bytes: Buffer, { marker, start }: JpegSegment): boolean {
  if (marker === COM) return false;
  if (marker < APP0 || marker > APP14 + 1) return true;
  if (marker === APP2) return bytes.subarray(start + 4, start + 16).equals(ICC_PROFILE);
  return marker === APP0 || marker === APP14;
}

function orientationSegment(orientation: number): Buffer {
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), orientationExif(orientation)]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(exif.length + 2, 2);
  return Buffer.concat([header, exif]);
}

interface Piece {
  start: number;
  end: number;
}

interface Walk {
  pieces: Piece[];
  scanned: boolean;
}

// What follows the end marker can carry metadata of its own, so only the segments are kept. Ones
// side by side stay one piece: a million scans kept as a million views took 190 MB.
function walk(bytes: Buffer): Walk {
  const pieces: Piece[] = [];
  let scanned = false;
  for (const segment of jpegSegments(bytes)) {
    scanned ||= segment.marker === SOS;
    if (!isNeeded(bytes, segment)) continue;
    const last = pieces.at(-1);
    if (last?.end === segment.start) last.end = segment.end;
    else pieces.push({ start: segment.start, end: segment.end });
  }
  return { pieces, scanned };
}

// JFIF wants to come first; the EXIF that says which way is up goes right after it.
function uprightAt(bytes: Buffer, first: Piece): number {
  if (bytes[first.start + 1] !== APP0) return first.start;
  return first.start + 2 + bytes.readUInt16BE(first.start + 2);
}

// Removes metadata without decoding, so not a pixel changes. Null when the bytes aren't a JPEG, or
// are cut off or broken before any image data: there is nothing whole to keep.
export function stripJpeg(bytes: Uint8Array, orientation: number): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  if (buffer[0] !== 0xff || buffer[1] !== SOI) return null;
  const { pieces, scanned } = walk(buffer);
  const [first, ...rest] = pieces;
  if (!scanned || !first) return null;
  const at = uprightAt(buffer, first);
  const upright = hasOrientation(orientation) ? [orientationSegment(orientation)] : [];
  return Buffer.concat([
    buffer.subarray(0, 2),
    buffer.subarray(first.start, at),
    ...upright,
    buffer.subarray(at, first.end),
    ...rest.map(({ start, end }) => buffer.subarray(start, end)),
  ]);
}
