import type { AttachmentMimeType } from '@tracker/shared';
import { imageSize } from 'image-size';
import type { ImageFacts } from './imagePlan';
import { stripMetadata } from './stripMetadata';

export interface StoredImage {
  bytes: Uint8Array;
  mimeType: AttachmentMimeType;
  width: number | null;
  height: number | null;
}

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

// Orientations 5 to 8 turn the picture a quarter, so it is shown with width and height swapped.
const isTurned = (orientation: number) => orientation >= 5 && orientation <= 8;

export function keptAsItCame(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
  facts: ImageFacts | null,
): StoredImage {
  const shape = shapeOf(original, facts);
  const bytes = stripMetadata(original, mimeType, shape?.orientation ?? 1);
  if (!shape) return { bytes, mimeType, width: null, height: null };
  const { width, height } = shape;
  const turned = isTurned(shape.orientation);
  return {
    bytes,
    mimeType,
    width: (turned ? height : width) || null,
    height: (turned ? width : height) || null,
  };
}
