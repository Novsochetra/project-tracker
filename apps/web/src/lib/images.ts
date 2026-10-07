export const MAX_IMAGE_EDGE = 2048;
export const MAX_UNTOUCHED_BYTES = 2 * 1024 * 1024;
export const JPEG_QUALITY = 0.85;

export interface Size {
  width: number;
  height: number;
}

export interface PreparedImage {
  blob: Blob;
  fileName: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function fitWithin(width: number, height: number, max: number): Size {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export const uploadName = (file: File): string =>
  file.name || `image.${EXTENSIONS[file.type] ?? 'png'}`;

export function jpegName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]*$/, '');
  return `${base || 'image'}.jpg`;
}

const isGif = (file: File): boolean => file.type === 'image/gif' || /\.gif$/i.test(file.name);

// Only Safari shows HEIC, so a decodable one is converted for everyone else.
const isHeic = (file: File): boolean =>
  /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name);

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function encodeJpeg(bitmap: ImageBitmap, size: Size): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  // JPEG has no alpha; paint white first so transparent screenshots don't turn black.
  context.fillStyle = 'white';
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

async function reencode(file: File, bitmap: ImageBitmap): Promise<Blob | null> {
  const oversized = Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_EDGE;
  const mustConvert = oversized || isHeic(file);
  if (!mustConvert && file.size <= MAX_UNTOUCHED_BYTES) return null;
  const blob = await encodeJpeg(bitmap, fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE));
  if (!blob || (!mustConvert && blob.size >= file.size)) return null;
  return blob;
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const original: PreparedImage = { blob: file, fileName: uploadName(file) };
  if (isGif(file)) return original;
  const bitmap = await decode(file);
  if (!bitmap) return original;
  try {
    const blob = await reencode(file, bitmap);
    return blob ? { blob, fileName: jpegName(original.fileName) } : original;
  } catch {
    return original;
  } finally {
    bitmap.close();
  }
}
