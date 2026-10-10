import {
  ATTACHMENT_KINDS,
  MAX_LOSSLESS_PIXELS,
  MAX_PHOTO_PIXELS,
  sizeWithin,
  type AttachmentMimeType,
  type PixelSize,
} from '@tracker/shared';

// A photo this light and within the server's budget goes as it is: a pass here would only lose
// detail, and the server strips its metadata (GPS included) as it makes its WebP.
export const MAX_UNTOUCHED_PHOTO_BYTES = 2 * 1024 * 1024;

// Close to lossless, as the server encodes the photo once more (WebP, quality 80). A 4.9 MB, 12 MP
// iPhone photo comes out at 2.4 MB in Safari (1.7 MB in Chrome): 19 s at 1 Mbit/s, well within the
// 5 minutes Railway gives an upload.
export const JPEG_QUALITY = 0.92;

export type EncodedType = 'image/jpeg' | 'image/png';

export interface Encoding extends PixelSize {
  type: EncodedType;
}

export interface ImagePlan {
  // Tried in order; the first that comes out within the upload limit is sent.
  encodings: Encoding[];
  // False while the original could go as it is: an encoding is then sent only if it is smaller.
  mustConvert: boolean;
}

export interface SourceImage extends PixelSize {
  type: AttachmentMimeType;
  bytes: number;
}

const pixelsOf = ({ width, height }: PixelSize): number => width * height;

const asPhoto = (source: SourceImage): Encoding => ({
  type: 'image/jpeg',
  ...sizeWithin(source.width, source.height, MAX_PHOTO_PIXELS),
});

const asScreenshot = (source: SourceImage): Encoding => ({
  type: 'image/png',
  ...sizeWithin(source.width, source.height, MAX_LOSSLESS_PIXELS),
});

// Screenshots stay PNG, so the server stores them lossless and text stays sharp. Past the upload
// limit a PNG holds a photo's detail, and only a JPEG brings it under.
function planPng(source: SourceImage): ImagePlan | null {
  const fits = pixelsOf(source) <= MAX_LOSSLESS_PIXELS;
  if (fits && source.bytes <= ATTACHMENT_KINDS.image.maxBytes) return null;
  const encodings = fits ? [asPhoto(source)] : [asScreenshot(source), asPhoto(source)];
  return { encodings, mustConvert: true };
}

function planPhoto(source: SourceImage): ImagePlan | null {
  const fits = pixelsOf(source) <= MAX_PHOTO_PIXELS;
  if (fits && source.bytes <= MAX_UNTOUCHED_PHOTO_BYTES) return null;
  return { encodings: [asPhoto(source)], mustConvert: !fits };
}

// Null sends the image as it is. Only Safari shows HEIC and the server can neither read one nor
// strip its GPS, so a HEIC the browser can decode is always converted.
export function planImage(source: SourceImage): ImagePlan | null {
  if (source.type === 'image/gif') return null;
  if (source.type === 'image/heic' || source.type === 'image/heif') {
    return { encodings: [asPhoto(source)], mustConvert: true };
  }
  return source.type === 'image/png' ? planPng(source) : planPhoto(source);
}
