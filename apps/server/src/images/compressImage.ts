import type { AttachmentMimeType } from '@tracker/shared';
import sharp from 'sharp';
import {
  MIN_SAVING_BYTES,
  PHOTO_QUALITY,
  isWorthStoring,
  planImage,
  workBytes,
  type ImageFacts,
  type ImagePlan,
} from './imagePlan';
import { keptAsItCame, type StoredImage } from './keptAsItCame';
import { createWorkLimiter } from './limiter';

export type { StoredImage } from './keptAsItCame';

// Every upload is a different image, so libvips' cache of recent work would only hold memory.
sharp.cache(false);
// One thread an image: measured as fast as a thread per core for several uploads, with a third
// less memory, and the same everywhere (sharp already picks one on Linux without jemalloc).
sharp.concurrency(1);
// sharp reads what a file is, not what its type says. Only these readers run, so a body sent as an
// image is never drawn as SVG (librsvg), TIFF, PDF or anything else libvips can open.
sharp.block({ operation: ['VipsForeignLoad'] });
sharp.unblock({
  operation: [
    'VipsForeignLoadJpegBuffer',
    'VipsForeignLoadPngBuffer',
    'VipsForeignLoadWebpBuffer',
    'VipsForeignLoadHeifBuffer',
  ],
});

// sharp's prebuilt libvips has no HEVC decoder (a patent licence matter), so it reads HEIC only
// when built against one. Without it, HEIC photos are kept as they came.
export const DECODES_HEIC = sharp.format.heif.input.fileSuffix?.includes('.heic') ?? false;

const FORMAT_OF_TYPE: Partial<Record<AttachmentMimeType, string>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  ...(DECODES_HEIC ? { 'image/heic': 'heif', 'image/heif': 'heif' } : {}),
};

const MB = 1024 * 1024;

// Images are let in while their estimated memory (imagePlan's workBytes) fits in their lane
// together; one estimated bigger than its lane runs alone (createWorkLimiter). Photos, the usual
// upload, have a lane of their own, so one never waits behind big scans or screenshots. This also
// leaves Node's thread pool, which file and DNS work share, to other requests.
const PHOTO_WORK_BYTES = 100 * MB;
const photoLane = createWorkLimiter(200 * MB);
const bigLane = createWorkLimiter(350 * MB);
const laneFor = (cost: number) => (cost <= PHOTO_WORK_BYTES ? photoLane : bigLane);

// A slow or stuck encode gives up and the image is kept, stripped, rather than holding its place.
const ENCODE_TIMEOUT_SECONDS = 30;

// failOn 'none': libjpeg warns about files every viewer shows (extra bytes before a marker, a cut
// off end); refusing those kept their GPS (PT-127 review). Reads only as far as each step needs.
const OPEN = { failOn: 'none', sequentialRead: true, autoOrient: true } as const;

async function factsOf(original: Uint8Array, mimeType: AttachmentMimeType) {
  const format = FORMAT_OF_TYPE[mimeType];
  if (!format) return null;
  const meta = await sharp(original, OPEN)
    .metadata()
    .catch(() => null);
  if (meta?.format !== format || !meta.width || !meta.height) return null;
  return {
    width: meta.width,
    height: meta.height,
    pages: meta.pages ?? 1,
    orientation: meta.orientation ?? 1,
    channels: meta.channels ?? 4,
    decodedWhole: meta.isProgressive || format === 'webp' || format === 'heif',
    hasMetadata: Boolean(meta.exif ?? meta.xmp ?? meta.iptc ?? meta.comments?.length),
  } satisfies ImageFacts;
}

// sharp writes no metadata unless asked, and converts colors to sRGB.
function encode(original: Uint8Array, plan: ImagePlan) {
  const image = sharp(original, OPEN).timeout({ seconds: ENCODE_TIMEOUT_SECONDS });
  if (plan.longSide) {
    image.resize({ width: plan.longSide, height: plan.longSide, fit: 'inside' });
  }
  const options = plan.lossless ? { lossless: true } : { quality: PHOTO_QUALITY };
  return image.webp(options).toBuffer({ resolveWithObject: true });
}

async function compressed(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
  facts: ImageFacts,
): Promise<StoredImage | null> {
  const plan = planImage(mimeType, facts);
  if (!plan) return null;
  if (!plan.mustReencode && original.byteLength < MIN_SAVING_BYTES) return null;
  const cost = workBytes(facts, plan);
  const { data, info } = await laneFor(cost)(cost, () => encode(original, plan));
  if (!plan.mustReencode && !isWorthStoring(original.byteLength, data.byteLength)) return null;
  return { bytes: data, mimeType: 'image/webp', width: info.width, height: info.height };
}

// An upload never fails for compression's sake: an image that isn't compressed is kept as it came,
// without its metadata (keptAsItCame).
export async function compressImage(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
): Promise<StoredImage> {
  const facts = await factsOf(original, mimeType);
  try {
    const image = facts && (await compressed(original, mimeType, facts));
    if (image) return image;
  } catch (error) {
    console.warn(`Image kept as uploaded: ${(error as Error).message}`);
  }
  return keptAsItCame(original, mimeType, facts);
}
