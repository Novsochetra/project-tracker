import { asBuffer } from './asBuffer';
import { hasOrientation, orientationExif } from './exifOrientation';
import { APP0, appHeader } from './jpegAppHeaders';
import { EOI, SOS, jpegSegments, type JpegSegment } from './jpegSegments';

const SOI = 0xd8;
const SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
const DHT = 0xc4;
const DAC = 0xcc;
const DQT = 0xdb;
const DNL = 0xdc;
const DRI = 0xdd;
const APP2 = 0xe2;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

// Anything libjpeg doesn't draw the picture from can carry any bytes (EXIF with GPS and camera,
// XMP, IPTC, comments, unknown markers), so it goes wherever it is, between scans too (PT-146).
const KEPT = new Set([...SOF, DHT, DAC, DQT, DNL, DRI, SOS, EOI]);

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

type Piece = Buffer | { start: number; end: number };

interface Walk {
  pieces: Piece[];
  scanned: boolean;
}

// Segments side by side stay one piece: a million scans kept as a million views took 190 MB.
function keep(pieces: Piece[], { start, end }: JpegSegment) {
  const last = pieces.at(-1);
  if (last && !Buffer.isBuffer(last) && last.end === start) last.end = end;
  else pieces.push({ start, end });
}

// What follows the end marker can carry metadata of its own, so only the segments are kept. A
// file needs one JFIF and one Adobe header; more of them would carry seven free bytes each.
function walk(bytes: Buffer): Walk {
  const pieces: Piece[] = [];
  const headers = new Set<number>();
  let scanned = false;
  for (const segment of jpegSegments(bytes)) {
    scanned ||= segment.marker === SOS;
    const header = appHeader(bytes, segment);
    if (!header) {
      if (isNeeded(bytes, segment)) keep(pieces, segment);
    } else if (!headers.has(segment.marker)) {
      headers.add(segment.marker);
      pieces.push(header);
    }
  }
  return { pieces, scanned };
}

// JFIF wants to come first; the EXIF that says which way is up goes right after it.
function withUpright(pieces: Piece[], orientation: number): Piece[] {
  if (!hasOrientation(orientation)) return pieces;
  const [first, ...rest] = pieces;
  const upright = orientationSegment(orientation);
  const jfif = Buffer.isBuffer(first) && first[1] === APP0;
  return jfif ? [first, upright, ...rest] : [upright, ...pieces];
}

// Removes metadata without decoding, so not a pixel changes. Null when the bytes aren't a JPEG, or
// are cut off or broken before any image data: there is nothing whole to keep.
export function stripJpeg(bytes: Uint8Array, orientation: number): Uint8Array | null {
  const buffer = asBuffer(bytes);
  if (buffer[0] !== 0xff || buffer[1] !== SOI) return null;
  const { pieces, scanned } = walk(buffer);
  if (!scanned) return null;
  const parts = withUpright(pieces, orientation).map((piece) =>
    Buffer.isBuffer(piece) ? piece : buffer.subarray(piece.start, piece.end),
  );
  return Buffer.concat([buffer.subarray(0, 2), ...parts]);
}
