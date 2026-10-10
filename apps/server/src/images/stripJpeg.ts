import { hasOrientation, orientationExif } from './exifOrientation';
import { EOI, SOS, headerEnd, jpegSegments, type JpegSegment } from './jpegSegments';

const SOI = 0xd8;
const SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
const DHT = 0xc4;
const DAC = 0xcc;
const DQT = 0xdb;
const DNL = 0xdc;
const DRI = 0xdd;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

// Only what the pixels need: the frame, its tables and scans, JFIF (APP0), the color profile (APP2
// ICC_PROFILE) and Adobe's color transform (APP14). Everything else can carry any bytes and goes,
// wherever it is, between scans too: every other APPn (EXIF with GPS and camera, XMP, IPTC, MPF),
// comments, and markers libjpeg doesn't know (PT-146).
const KEPT = new Set([...SOF, DHT, DAC, DQT, DNL, DRI, SOS, EOI, APP0, APP14]);

function isNeeded(bytes: Buffer, { marker, start }: JpegSegment): boolean {
  if (marker === APP2) return bytes.subarray(start + 4, start + 16).equals(ICC_PROFILE);
  return KEPT.has(marker);
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
  return bytes[first.start + 1] === APP0 ? headerEnd(bytes, first.start) : first.start;
}

// Removes metadata without decoding, so not a pixel changes. Null when the bytes aren't a JPEG, or
// are cut off or broken before any image data: there is nothing whole to keep.
export function stripJpeg(bytes: Uint8Array, orientation: number): Uint8Array | null {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
