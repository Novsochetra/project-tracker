import type { AttachmentMimeType } from '@tracker/shared';
import { imageSize } from 'image-size';
import sharp, { type Metadata } from 'sharp';
import {
  MAX_INPUT_PIXELS,
  MIN_SAVING_BYTES,
  PHOTO_QUALITY,
  isWorthStoring,
  planImage,
  type ImageFacts,
  type ImagePlan,
} from './imagePlan';
import { createLimiter } from './limiter';

// Every upload is a different image, so libvips' cache of recent work would only hold memory.
sharp.cache(false);
// One thread an image, two images at a time (encodeLimit): measured as fast as libvips' default of
// a thread per core for several uploads, with a third less memory, and the same everywhere (sharp
// already picks one thread on Linux without jemalloc, as on Railway).
sharp.concurrency(1);

// sharp's prebuilt libvips has no HEVC decoder (a patent licence matter), so it reads HEIC only
// when built against one. Without it, HEIC photos are kept as they came.
export const DECODES_HEIC = sharp.format.heif.input.fileSuffix?.includes('.heic') ?? false;

const COMPRESSED_TYPES: ReadonlySet<AttachmentMimeType> = new Set<AttachmentMimeType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  ...(DECODES_HEIC ? (['image/heic', 'image/heif'] as const) : []),
]);

// A 12 MP photo takes about 55 MB while it is encoded, a 4K screenshot about 250 MB. Two at a
// time bounds that, and leaves Node's thread pool, which file and DNS work share, to other requests.
const encodeLimit = createLimiter(2);

// Reads only as far as each step needs, instead of decoding the whole image first.
const OPEN = { limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true, autoOrient: true };

export interface StoredImage {
  bytes: Uint8Array;
  mimeType: AttachmentMimeType;
  width: number | null;
  height: number | null;
}

function factsOf(meta: Metadata): ImageFacts | null {
  if (!meta.width || !meta.height) return null;
  return {
    width: meta.width,
    height: meta.height,
    pages: meta.pages ?? 1,
    orientation: meta.orientation ?? 1,
    hasMetadata: Boolean(meta.exif ?? meta.xmp ?? meta.iptc ?? meta.comments?.length),
  };
}

// sharp writes no metadata unless asked, and converts colors to sRGB.
function encode(original: Uint8Array, plan: ImagePlan) {
  const image = sharp(original, OPEN);
  if (plan.longSide) {
    image.resize({ width: plan.longSide, height: plan.longSide, fit: 'inside' });
  }
  const options = plan.lossless ? { lossless: true } : { quality: PHOTO_QUALITY };
  return image.webp(options).toBuffer({ resolveWithObject: true });
}

function asItCame(original: Uint8Array, mimeType: AttachmentMimeType): StoredImage {
  try {
    const { width, height } = imageSize(original);
    return { bytes: original, mimeType, width: width || null, height: height || null };
  } catch {
    return { bytes: original, mimeType, width: null, height: null };
  }
}

async function compressed(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
): Promise<StoredImage | null> {
  const facts = factsOf(await sharp(original).metadata());
  const plan = facts && planImage(mimeType, facts);
  if (!plan) return null;
  if (!plan.mustReencode && original.byteLength < MIN_SAVING_BYTES) return null;
  const { data, info } = await encodeLimit(() => encode(original, plan));
  if (!plan.mustReencode && !isWorthStoring(original.byteLength, data.byteLength)) return null;
  return { bytes: data, mimeType: 'image/webp', width: info.width, height: info.height };
}

// An upload never fails for compression's sake: an image sharp can't read is kept as it came.
export async function compressImage(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
): Promise<StoredImage> {
  if (!COMPRESSED_TYPES.has(mimeType)) return asItCame(original, mimeType);
  try {
    return (await compressed(original, mimeType)) ?? asItCame(original, mimeType);
  } catch (error) {
    console.warn(`Image kept as uploaded: ${(error as Error).message}`);
    return asItCame(original, mimeType);
  }
}
