import type { AttachmentMimeType } from '@tracker/shared';
import { stripJpeg } from './stripJpeg';
import { stripPng } from './stripPng';
import { stripWebp } from './stripWebp';

// For an image stored as it came (too big to decode, animated, unreadable by sharp, or too small to
// be worth re-encoding): its metadata goes at the byte level, so its location and camera never
// leave with it. Picked by what the bytes are (sniffImageType), not what the name says. Null when
// they aren't a whole image of that type. GIF has no place for a location, and HEIC stays as it is
// (docs/architecture.md).
export function stripMetadata(
  bytes: Uint8Array,
  type: AttachmentMimeType,
  orientation: number,
): Uint8Array | null {
  if (type === 'image/jpeg') return stripJpeg(bytes, orientation);
  if (type === 'image/png') return stripPng(bytes, orientation);
  if (type === 'image/webp') return stripWebp(bytes);
  return bytes;
}
