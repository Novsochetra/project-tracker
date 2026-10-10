import {
  ATTACHMENT_KINDS,
  MAX_LOSSLESS_PIXELS,
  MAX_PHOTO_PIXELS,
  MAX_WHOLE_DECODE_PIXELS,
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
  contentIsJpegOrWebp: boolean;
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

// The server strips a JPEG or WebP of its GPS and, up to MAX_WHOLE_DECODE_PIXELS, shrinks it to the
// budget in its one lossy pass, so such an original goes when it is the smaller, even past the
// budget (PT-145).
function planPhoto(source: SourceImage): ImagePlan | null {
  const pixels = pixelsOf(source);
  if (pixels <= MAX_PHOTO_PIXELS && source.bytes <= MAX_UNTOUCHED_PHOTO_BYTES) return null;
  return { encodings: [asPhoto(source)], mustConvert: pixels > MAX_WHOLE_DECODE_PIXELS };
}

// Null sends the image as it is. The server can neither read a HEIC or an AVIF nor strip its GPS,
// and a browser decodes one by its bytes while its type comes from its name, so one named .jpg comes
// as image/jpeg. A photo whose bytes aren't JPEG or WebP is therefore always converted.
export function planImage(source: SourceImage): ImagePlan | null {
  if (source.type === 'image/gif') return null;
  if (source.type === 'image/png') return planPng(source);
  if (!source.contentIsJpegOrWebp) return { encodings: [asPhoto(source)], mustConvert: true };
  return planPhoto(source);
}
