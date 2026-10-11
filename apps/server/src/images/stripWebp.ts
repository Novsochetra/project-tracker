import { asBuffer } from './asBuffer';

const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;

// Chunks that make up the picture, its animation and its color. Every other chunk goes: EXIF, XMP
// and ones no reader knows, which can carry anything.
const PICTURE = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
const IMAGE_DATA = new Set(['VP8 ', 'VP8L', 'ANMF']);

// The extended header says which chunks follow; it can't announce the ones removed.
function withoutMetadataFlags(chunk: Buffer): Buffer {
  const copy = Buffer.from(chunk);
  copy[8] = copy[8]! & ~(EXIF_FLAG | XMP_FLAG);
  return copy;
}

// Null when the bytes aren't a WebP, or have no image data. Keeps every frame of an animation.
export function stripWebp(bytes: Uint8Array): Uint8Array | null {
  const buffer = asBuffer(bytes);
  const riff = buffer.toString('latin1', 0, 4) === 'RIFF';
  if (!riff || buffer.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kept: Buffer[] = [];
  let whole = false;
  for (let at = 12; at + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(at + 4);
    const end = at + 8 + size + (size % 2);
    if (end > buffer.length) break;
    const type = buffer.toString('latin1', at, at + 4);
    const chunk = buffer.subarray(at, end);
    if (type === 'VP8X') kept.push(withoutMetadataFlags(chunk));
    else if (PICTURE.has(type)) kept.push(chunk);
    whole ||= IMAGE_DATA.has(type);
    at = end;
  }
  if (!whole) return null;
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
