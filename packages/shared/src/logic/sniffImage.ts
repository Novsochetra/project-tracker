import type { AttachmentMimeType } from '../domain/attachment';

export type SniffedType = AttachmentMimeType | 'image/tiff';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']);

const text = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

const startsWith = (bytes: Uint8Array, start: readonly number[]) =>
  start.every((byte, index) => bytes[index] === byte);

// What the bytes are, whatever the name or the browser said: a JPEG saved as .png arrives as
// image/png (PT-127 review). Null for anything else, which is kept as declared. A JPEG is known by
// its start marker alone, as libjpeg and libvips know it: they skip stray bytes after it, and one
// with a byte there was shown, yet kept with its GPS.
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (startsWith(bytes, PNG)) return 'image/png';
  if (text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (text(bytes, 0, 6) === 'GIF87a' || text(bytes, 0, 6) === 'GIF89a') return 'image/gif';
  if (text(bytes, 4, 8) === 'ftyp') {
    return HEIC_BRANDS.has(text(bytes, 8, 12)) ? 'image/heic' : 'image/heif';
  }
  const tiff = text(bytes, 0, 4);
  return tiff === 'II*\0' || tiff === 'MM\0*' ? 'image/tiff' : null;
}
