import type { AttachmentMimeType } from '@tracker/shared';
import { stripJpeg } from './stripJpeg';
import { stripPng } from './stripPng';
import { stripWebp } from './stripWebp';

// For an image stored as it came (too big to decode, animated, unreadable by sharp, or too small to
// be worth re-encoding): its metadata goes at the byte level, so its location and camera never
// leave with it. GIF has no place for them, and HEIC stays as it is (docs/architecture.md).
export function stripMetadata(
  bytes: Uint8Array,
  mimeType: AttachmentMimeType,
  orientation: number,
): Uint8Array {
  if (mimeType === 'image/jpeg') return stripJpeg(bytes, orientation) ?? bytes;
  if (mimeType === 'image/png') return stripPng(bytes) ?? bytes;
  if (mimeType === 'image/webp') return stripWebp(bytes) ?? bytes;
  return bytes;
}
