import type { AttachmentMimeType } from '@tracker/shared';

export type SniffedType = AttachmentMimeType | 'image/tiff';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']);

const text = (bytes: Uint8Array, from: number, to: number) =>
  Buffer.from(bytes.subarray(from, to)).toString('latin1');

// What the bytes are, whatever the name or the browser said: a JPEG saved as .png arrives as
// image/png (PT-127 review). Null for anything else, which is kept as declared.
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (Buffer.from(bytes.subarray(0, 8)).equals(PNG)) return 'image/png';
  if (text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (text(bytes, 0, 6) === 'GIF87a' || text(bytes, 0, 6) === 'GIF89a') return 'image/gif';
  if (text(bytes, 4, 8) === 'ftyp') {
    return HEIC_BRANDS.has(text(bytes, 8, 12)) ? 'image/heic' : 'image/heif';
  }
  const tiff = text(bytes, 0, 4);
  return tiff === 'II*\0' || tiff === 'MM\0*' ? 'image/tiff' : null;
}
