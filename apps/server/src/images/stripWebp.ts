import { asBuffer } from './asBuffer';
import { isWellFormedIccProfile } from './iccProfile';

const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;
const ICC_FLAG = 0x20;

// Chunks that make up the picture, its animation and its color. Every other chunk goes: EXIF, XMP
// and ones no reader knows, which can carry anything, and so does a color profile with bytes no
// color reader reads (PT-175).
const PICTURE = new Set(['VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF']);
const IMAGE_DATA = new Set(['VP8 ', 'VP8L', 'ANMF']);

interface Walk {
  kept: Buffer[];
  icc: boolean;
  whole: boolean;
}

const typeOf = (chunk: Buffer) => chunk.toString('latin1', 0, 4);

function isKept(type: string, chunk: Buffer): boolean {
  if (type === 'VP8X') return true;
  if (type === 'ICCP') return isWellFormedIccProfile(chunk.subarray(8, 8 + chunk.readUInt32LE(4)));
  return PICTURE.has(type);
}

// The extended header says which chunks follow; it can't announce the ones removed.
function withoutDroppedFlags(header: Buffer, icc: boolean): Buffer {
  const copy = Buffer.from(header);
  copy[8] = copy[8]! & ~(EXIF_FLAG | XMP_FLAG | (icc ? 0 : ICC_FLAG));
  return copy;
}

function walk(buffer: Buffer): Walk {
  const found: Walk = { kept: [], icc: false, whole: false };
  for (let at = 12; at + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(at + 4);
    const end = at + 8 + size + (size % 2);
    if (end > buffer.length) break;
    const chunk = buffer.subarray(at, end);
    const type = typeOf(chunk);
    const kept = isKept(type, chunk);
    if (kept) found.kept.push(chunk);
    found.icc ||= kept && type === 'ICCP';
    found.whole ||= IMAGE_DATA.has(type);
    at = end;
  }
  return found;
}

// Null when the bytes aren't a WebP, or have no image data. Keeps every frame of an animation.
export function stripWebp(bytes: Uint8Array): Uint8Array | null {
  const buffer = asBuffer(bytes);
  const riff = buffer.toString('latin1', 0, 4) === 'RIFF';
  if (!riff || buffer.toString('latin1', 8, 12) !== 'WEBP') return null;
  const { kept, icc, whole } = walk(buffer);
  if (!whole) return null;
  const body = Buffer.concat(
    kept.map((chunk) => (typeOf(chunk) === 'VP8X' ? withoutDroppedFlags(chunk, icc) : chunk)),
  );
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
