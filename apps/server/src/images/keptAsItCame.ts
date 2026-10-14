import type { AttachmentMimeType } from '@tracker/shared';
import { imageSize } from 'image-size';
import { isTurned } from './exifOrientation';
import type { ImageFacts } from './imagePlan';
import { stripMetadata } from './stripMetadata';

export interface StoredImage {
  bytes: Uint8Array;
  mimeType: AttachmentMimeType;
  width: number | null;
  height: number | null;
  // Set when the image must not be stored: the upload is refused with this message.
  refusal?: string | undefined;
}

// Never stored with its metadata, nor stripped into a file nothing could show (PT-127 review).
export const NOT_WHOLE_MESSAGE =
  'This image is cut off or damaged before its picture. Save it again and add it once more.';

interface Shape {
  width: number;
  height: number;
  orientation: number;
}

function shapeOf(bytes: Uint8Array, facts: ImageFacts | null): Shape | null {
  if (facts) return facts;
  try {
    const { width, height, orientation } = imageSize(bytes);
    return { width, height, orientation: orientation ?? 1 };
  } catch {
    return null;
  }
}

// `recognized`: the bytes are the image `mimeType` says (sniffImageType). Bytes that are no image
// at all have no metadata to find, and are kept as they are, with no size: only a known size
// lets them show as a picture in Claude's answer (PT-225 review; image-size reads SVG too).
export function keptAsItCame(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
  facts: ImageFacts | null,
  recognized: boolean,
): StoredImage {
  const shape = recognized ? shapeOf(original, facts) : null;
  const orientation = shape?.orientation ?? 1;
  const stripped = recognized ? stripMetadata(original, mimeType, orientation) : original;
  const bytes = stripped ?? original;
  const refusal = stripped ? undefined : NOT_WHOLE_MESSAGE;
  if (!shape) return { bytes, mimeType, width: null, height: null, refusal };
  // Orientations 5 to 8 turn the picture a quarter, so it is shown with width and height swapped.
  const turned = isTurned(shape.orientation);
  const width = (turned ? shape.height : shape.width) || null;
  const height = (turned ? shape.width : shape.height) || null;
  return { bytes, mimeType, width, height, refusal };
}
