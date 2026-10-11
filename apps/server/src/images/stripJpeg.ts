import { asBuffer } from './asBuffer';
import { hasOrientation, orientationExif } from './exifOrientation';
import { APP0, appHeader } from './jpegAppHeaders';
import { isIccChunk, isWholeIccProfile } from './jpegIcc';
import { EOI, SOS, jpegSegments, type JpegSegment } from './jpegSegments';

const SOI = 0xd8;
const SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
const DHT = 0xc4;
const DAC = 0xcc;
const DQT = 0xdb;
const DNL = 0xdc;
const DRI = 0xdd;

// Anything libjpeg doesn't draw the picture from can carry any bytes (EXIF with GPS and camera,
// XMP, IPTC, comments, unknown markers), so it goes wherever it is, between scans too (PT-146).
const KEPT = new Set([...SOF, DHT, DAC, DQT, DNL, DRI, SOS, EOI]);

// A chunk's count is one byte, so past 255 chunks no profile is whole and more are dropped unseen,
// rather than held as a view each.
const MAX_ICC_CHUNKS = 255;

function orientationSegment(orientation: number): Buffer {
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), orientationExif(orientation)]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(exif.length + 2, 2);
  return Buffer.concat([header, exif]);
}

type Piece = Buffer | { start: number; end: number };

interface Walk {
  pieces: Piece[];
  iccChunks: Buffer[];
  headers: Set<number>;
  scanned: boolean;
}

// Segments side by side stay one piece: a million scans kept as a million views took 190 MB.
function keep(pieces: Piece[], { start, end }: JpegSegment) {
  const last = pieces.at(-1);
  if (last && !Buffer.isBuffer(last) && last.end === start) last.end = end;
  else pieces.push({ start, end });
}

// A file needs one JFIF and one Adobe header; more of them would carry seven free bytes each. ICC
// chunks stay pieces of their own, to be dropped once all are seen if they make no whole profile.
function place(bytes: Buffer, segment: JpegSegment, found: Walk) {
  const header = appHeader(bytes, segment);
  if (header) {
    if (found.headers.has(segment.marker)) return;
    found.headers.add(segment.marker);
    found.pieces.push(header);
  } else if (isIccChunk(bytes, segment)) {
    if (found.iccChunks.length > MAX_ICC_CHUNKS) return;
    const chunk = bytes.subarray(segment.start, segment.end);
    found.iccChunks.push(chunk);
    found.pieces.push(chunk);
  } else if (KEPT.has(segment.marker)) {
    keep(found.pieces, segment);
  }
}

// What follows the end marker can carry metadata of its own, so only the segments are kept.
function walk(bytes: Buffer): Walk {
  const found: Walk = { pieces: [], iccChunks: [], headers: new Set(), scanned: false };
  for (const segment of jpegSegments(bytes)) {
    found.scanned ||= segment.marker === SOS;
    place(bytes, segment, found);
  }
  if (found.iccChunks.length === 0 || isWholeIccProfile(found.iccChunks)) return found;
  const icc = new Set<Piece>(found.iccChunks);
  return { ...found, pieces: found.pieces.filter((piece) => !icc.has(piece)) };
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
