import { crc32 } from 'node:zlib';
import { asBuffer } from './asBuffer';
import { hasOrientation, orientationExif } from './exifOrientation';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Ancillary chunks that change how the image looks: transparency, color, physical size and APNG's
// frames. Every other ancillary chunk goes: text, eXIf, tIME and ones no reader knows, which can
// carry anything. Critical chunks (an upper-case first letter) always stay.
const LOOKS = new Set([
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'pHYs',
  'sPLT',
  'hIST',
  'acTL',
  'fcTL',
  'fdAT',
  'cICP',
  'mDCV',
  'cLLI',
]);

const isCritical = (type: string) => type.charCodeAt(0) >= 0x41 && type.charCodeAt(0) <= 0x5a;

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, checksum]);
}

interface Walk {
  chunks: Buffer[];
  types: Set<string>;
}

// Up to IEND: anything after it, or a chunk cut off, is dropped.
function walk(buffer: Buffer): Walk {
  const chunks: Buffer[] = [];
  const types = new Set<string>();
  for (let at = 8; at + 12 <= buffer.length;) {
    const end = at + 12 + buffer.readUInt32BE(at);
    if (end > buffer.length) break;
    const type = buffer.toString('latin1', at + 4, at + 8);
    types.add(type);
    if (isCritical(type) || LOOKS.has(type)) chunks.push(buffer.subarray(at, end));
    at = end;
    if (type === 'IEND') break;
  }
  return { chunks, types };
}

// Removes metadata without decoding, keeping which way is up as a one-entry eXIf after IHDR. Null
// when the bytes aren't a PNG, or have no image data: there is nothing whole to keep.
export function stripPng(bytes: Uint8Array, orientation: number): Uint8Array | null {
  const buffer = asBuffer(bytes);
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) return null;
  const { chunks, types } = walk(buffer);
  if (!types.has('IHDR') || !types.has('IDAT')) return null;
  const [header, ...rest] = chunks;
  const upright = hasOrientation(orientation) ? [chunk('eXIf', orientationExif(orientation))] : [];
  return Buffer.concat([SIGNATURE, ...(header ? [header] : []), ...upright, ...rest]);
}
