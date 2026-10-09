const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

// Kept: JFIF (APP0), the color profile (APP2 ICC_PROFILE) and Adobe's color transform (APP14),
// which the pixels need. Dropped: every other APPn (EXIF with GPS and camera, XMP, IPTC, MPF) and
// comments.
function isNeeded(marker: number, segment: Uint8Array): boolean {
  if (marker === COM) return false;
  if (marker < APP0 || marker > APP14 + 1) return true;
  if (marker === APP2) return Buffer.from(segment.subarray(4, 16)).equals(ICC_PROFILE);
  return marker === APP0 || marker === APP14;
}

// The smallest EXIF that still says which way is up: one Orientation entry in IFD0.
function orientationSegment(orientation: number): Uint8Array {
  const segment = Buffer.alloc(36);
  segment.set([0xff, 0xe1, 0x00, 0x22], 0);
  segment.write('Exif\0\0MM\0*', 4, 'latin1');
  segment.writeUInt32BE(8, 14);
  segment.writeUInt16BE(1, 18);
  segment.set([0x01, 0x12, 0x00, 0x03], 20);
  segment.writeUInt32BE(1, 24);
  segment.writeUInt16BE(orientation, 28);
  return segment;
}

// Everything up to the end marker: what follows it (an iPhone's depth or HDR images, an app's
// trailer) can carry metadata of its own.
function imageData(bytes: Uint8Array, from: number): Uint8Array {
  const end = Buffer.from(bytes).indexOf(Buffer.from([0xff, EOI]), from);
  return bytes.subarray(from, end === -1 ? bytes.length : end + 2);
}

function headerSegments(bytes: Uint8Array): { segments: Uint8Array[]; data: Uint8Array } {
  const segments: Uint8Array[] = [];
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === SOS) return { segments, data: imageData(bytes, at) };
    const end = at + 2 + ((bytes[at + 2]! << 8) | bytes[at + 3]!);
    if (end > bytes.length) break;
    if (isNeeded(marker, bytes.subarray(at, end))) segments.push(bytes.subarray(at, end));
    at = end;
  }
  // Cut off or broken before the image data: what is left can't be shown and may be metadata.
  return { segments, data: new Uint8Array(0) };
}

// Null when the bytes aren't a JPEG. Removes metadata without decoding, so not a pixel changes.
export function stripJpeg(bytes: Uint8Array, orientation: number): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const { segments, data } = headerSegments(bytes);
  const upright = orientation > 1 && orientation <= 8 ? [orientationSegment(orientation)] : [];
  // JFIF wants to come first; the EXIF that says which way is up goes right after it.
  const [first, ...rest] = segments;
  const ordered = first?.[1] === APP0 ? [first, ...upright, ...rest] : [...upright, ...segments];
  return Buffer.concat([bytes.subarray(0, 2), ...ordered, data]);
}
