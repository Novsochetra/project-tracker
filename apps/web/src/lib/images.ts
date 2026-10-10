import { ATTACHMENT_KINDS, storedExtension, type AttachmentMimeType } from '@tracker/shared';
import { JPEG_QUALITY, planImage, type EncodedType, type Encoding } from './imagePlan';

export interface PreparedImage {
  blob: Blob;
  fileName: string;
}

export const uploadName = (file: File, type: AttachmentMimeType): string =>
  file.name || `image.${storedExtension(type)}`;

export function renamedAs(fileName: string, type: EncodedType): string {
  const base = fileName.replace(/\.[^./\\]*$/, '');
  return `${base || 'image'}.${storedExtension(type)}`;
}

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

// The canvas holds only pixels, so what it encodes carries no EXIF, GPS or other metadata.
function encode(bitmap: ImageBitmap, { type, width, height }: Encoding): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  if (type === 'image/jpeg') {
    // JPEG has no alpha; paint white first so transparent images don't turn black.
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
}

interface Encoded {
  blob: Blob;
  type: EncodedType;
}

async function encodeToFit(bitmap: ImageBitmap, encodings: Encoding[]): Promise<Encoded | null> {
  let encoded: Encoded | null = null;
  for (const encoding of encodings) {
    const blob = await encode(bitmap, encoding);
    if (!blob) return null;
    encoded = { blob, type: encoding.type };
    if (blob.size <= ATTACHMENT_KINDS.image.maxBytes) return encoded;
  }
  return encoded;
}

async function reencode(
  file: File,
  type: AttachmentMimeType,
  bitmap: ImageBitmap,
): Promise<Encoded | null> {
  const { width, height } = bitmap;
  const plan = planImage({ type, bytes: file.size, width, height });
  if (!plan) return null;
  const encoded = await encodeToFit(bitmap, plan.encodings);
  if (!encoded || (!plan.mustConvert && encoded.blob.size >= file.size)) return null;
  return encoded;
}

export async function prepareImageForUpload(
  file: File,
  type: AttachmentMimeType,
): Promise<PreparedImage> {
  const original: PreparedImage = { blob: file, fileName: uploadName(file, type) };
  // A GIF may move, and a canvas keeps only its first frame.
  if (type === 'image/gif') return original;
  const bitmap = await decode(file);
  if (!bitmap) return original;
  try {
    const encoded = await reencode(file, type, bitmap);
    if (!encoded) return original;
    return { blob: encoded.blob, fileName: renamedAs(original.fileName, encoded.type) };
  } catch {
    return original;
  } finally {
    bitmap.close();
  }
}
