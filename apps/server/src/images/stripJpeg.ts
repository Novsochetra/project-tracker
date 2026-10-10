import { hasOrientation, orientationExif } from './exifOrientation';

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

// Kept: JFIF (APP0), the color profile (APP2 ICC_PROFILE) and Adobe's color transform (APP14),
// which the pixels need. Dropped, wherever they are, between scans too: every other APPn (EXIF with
// GPS and camera, XMP, IPTC, MPF) and comments.
function isNeeded(marker: number, segment: Uint8Array): boolean {
  if (marker === COM) return false;
  if (marker < APP0 || marker > APP14 + 1) return true;
  if (marker === APP2) return Buffer.from(segment.subarray(4, 16)).equals(ICC_PROFILE);
  return marker === APP0 || marker === APP14;
}

function orientationSegment(orientation: number): Buffer {
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), orientationExif(orientation)]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(exif.length + 2, 2);
  return Buffer.concat([header, exif]);
}

// Like libjpeg, skips bytes that don't start a marker ("extraneous bytes") and the fill bytes
// before one. -1 when none is left.
function nextMarker(bytes: Buffer, from: number): number {
  let at = bytes.indexOf(0xff, from);
  while (at !== -1 && bytes[at + 1] === 0xff) at += 1;
  return at !== -1 && at + 1 < bytes.length ? at : -1;
}

// A scan's data runs to the next marker: an FF followed by anything but 00 (a stuffed FF) or a
// restart marker.
function scanEnd(bytes: Buffer, from: number): number {
  for (let at = bytes.indexOf(0xff, from); at !== -1; at = bytes.indexOf(0xff, at + 1)) {
    const next = bytes[at + 1];
    if (next === undefined) break;
    if (next !== 0x00 && next !== 0xff && (next < 0xd0 || next > 0xd7)) return at;
  }
  return bytes.length;
}

// Restart and TEM markers have no length, and FF 00 is no marker at all: none of them carries
// anything, and outside a scan they are stray.
const hasNoLength = (marker: number) =>
  marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

interface Walk {
  segments: Uint8Array[];
  scanned: boolean;
}

// What follows the end marker (an iPhone's depth or HDR images, an app's trailer) can carry
// metadata of its own, so the walk stops there. A segment cut off ends it too.
function walk(bytes: Buffer): Walk {
  const segments: Uint8Array[] = [];
  let scanned = false;
  for (let at = nextMarker(bytes, 2); at !== -1; at = nextMarker(bytes, at)) {
    const marker = bytes[at + 1]!;
    if (hasNoLength(marker)) {
      at += 2;
      continue;
    }
    if (marker === EOI) {
      segments.push(bytes.subarray(at, at + 2));
      break;
    }
    if (at + 4 > bytes.length) break;
    const end = at + 2 + bytes.readUInt16BE(at + 2);
    if (end > bytes.length) break;
    if (marker === SOS) {
      const dataEnd = scanEnd(bytes, end);
      segments.push(bytes.subarray(at, dataEnd));
      scanned = true;
      at = dataEnd;
      continue;
    }
    if (isNeeded(marker, bytes.subarray(at, end))) segments.push(bytes.subarray(at, end));
    at = end;
  }
  return { segments, scanned };
}

// Removes metadata without decoding, so not a pixel changes. Null when the bytes aren't a JPEG, or
// are cut off or broken before any image data: there is nothing whole to keep.
export function stripJpeg(bytes: Uint8Array, orientation: number): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  if (buffer[0] !== 0xff || buffer[1] !== SOI) return null;
  const { segments, scanned } = walk(buffer);
  if (!scanned) return null;
  const upright = hasOrientation(orientation) ? [orientationSegment(orientation)] : [];
  // JFIF wants to come first; the EXIF that says which way is up goes right after it.
  const [first, ...rest] = segments;
  const ordered = first?.[1] === APP0 ? [first, ...upright, ...rest] : [...upright, ...segments];
  return Buffer.concat([buffer.subarray(0, 2), ...ordered]);
}
