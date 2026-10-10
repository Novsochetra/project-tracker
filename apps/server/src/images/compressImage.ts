import {
  UNSUPPORTED_ATTACHMENT_MESSAGE,
  attachmentKind,
  type AttachmentMimeType,
} from '@tracker/shared';
import sharp from 'sharp';
import {
  MAX_WORK_BYTES,
  MIN_SAVING_BYTES,
  PHOTO_QUALITY,
  isWorthStoring,
  planImage,
  workBytes,
  type ImageFacts,
  type ImagePlan,
} from './imagePlan';
import { countJpegScans } from './jpegSegments';
import { keptAsItCame, type StoredImage } from './keptAsItCame';
import { createWorkLimiter } from './limiter';
import { sniffImageType } from './sniffImage';

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

const FORMAT_OF_TYPE: Partial<Record<AttachmentMimeType, ImageFacts['format']>> = {
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
const photoLane = createWorkLimiter(2 * PHOTO_WORK_BYTES);
const bigLane = createWorkLimiter(MAX_WORK_BYTES);
const laneFor = (cost: number) => (cost <= PHOTO_WORK_BYTES ? photoLane : bigLane);

// A slow or stuck encode gives up and the image is kept, stripped, rather than holding its place.
const ENCODE_TIMEOUT_SECONDS = 30;

// failOn 'none': libjpeg warns about files every viewer shows (extra bytes before a marker, a cut
// off end); refusing those kept their GPS (PT-127 review). Reads only as far as each step needs.
const OPEN = { failOn: 'none', sequentialRead: true, autoOrient: true } as const;

async function factsOf(
  original: Uint8Array,
  mimeType: AttachmentMimeType,
): Promise<ImageFacts | null> {
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
    format,
    progressive: meta.isProgressive,
    scans: format === 'jpeg' ? countJpegScans(original) : 1,
    hasMetadata: Boolean(meta.exif ?? meta.xmp ?? meta.iptc ?? meta.comments?.length),
  };
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

// An image that isn't compressed is kept as it came, without its metadata (keptAsItCame). The
// upload is refused only for an image whose metadata can't be removed: a TIFF, or one cut off
// before its picture. Compression failing never refuses one.
export async function compressImage(
  original: Uint8Array,
  declared: AttachmentMimeType,
): Promise<StoredImage> {
  // The bytes decide what an image is, and so how it is read, stripped, stored and named; the
  // declared type only stands for bytes that are no image we know.
  const sniffed = sniffImageType(original);
  if (sniffed === 'image/tiff') {
    const refusal = UNSUPPORTED_ATTACHMENT_MESSAGE;
    return { bytes: original, mimeType: declared, width: null, height: null, refusal };
  }
  const recognized = sniffed !== null && attachmentKind(sniffed) === 'image';
  const mimeType = recognized ? sniffed : declared;
  const facts = await factsOf(original, mimeType);
  try {
    const image = facts && (await compressed(original, mimeType, facts));
    if (image) return image;
  } catch (error) {
    console.warn(`Image kept as uploaded: ${(error as Error).message}`);
  }
  return keptAsItCame(original, mimeType, facts, recognized);
}
