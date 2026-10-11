import { isWellFormedIccProfile } from './iccProfile';
import type { JpegSegment } from './jpegSegments';

const APP2 = 0xe2;
const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');
const NUMBER_AT = 4 + ICC_PROFILE.length;
const DATA_AT = NUMBER_AT + 2;

export const isIccChunk = (bytes: Buffer, { marker, start }: JpegSegment) =>
  marker === APP2 && bytes.subarray(start + 4, start + NUMBER_AT).equals(ICC_PROFILE);

// libjpeg joins the chunks by their numbers, 1 up to their count, and ignores a profile whose
// chunks don't make that up exactly once.
function joined(segments: Buffer[]): Buffer | null {
  const parts: Buffer[] = [];
  for (const segment of segments) {
    if (segment.length < DATA_AT) return null;
    const number = segment[NUMBER_AT]!;
    const count = segment[NUMBER_AT + 1]!;
    if (count !== segments.length || number < 1 || number > count || parts[number - 1]) {
      return null;
    }
    parts[number - 1] = segment.subarray(DATA_AT);
  }
  return Buffer.concat(parts);
}

export function isWholeIccProfile(segments: Buffer[]): boolean {
  const profile = joined(segments);
  return profile !== null && isWellFormedIccProfile(profile);
}
