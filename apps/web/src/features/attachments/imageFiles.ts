import { IMAGE_MIME_TYPES } from '@tracker/shared';

export const UNSUPPORTED_IMAGE_MESSAGE =
  'Only PNG, JPEG, GIF, WebP and HEIC images can be attached.';

const IMAGE_TYPES: ReadonlySet<string> = new Set(IMAGE_MIME_TYPES);
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|hei[cf])$/i;

// Some browsers leave the type empty for HEIC photos, so the name decides for those.
export const isImageFile = (file: File): boolean =>
  file.type ? IMAGE_TYPES.has(file.type.toLowerCase()) : IMAGE_NAME.test(file.name);

export interface ImagePartition {
  images: File[];
  rejected: File[];
}

export function partitionImages(files: Iterable<File>): ImagePartition {
  const images: File[] = [];
  const rejected: File[] = [];
  for (const file of files) (isImageFile(file) ? images : rejected).push(file);
  return { images, rejected };
}

export function filesOf(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.files.length > 0) return Array.from(data.files);
  return Array.from(data.items).flatMap((item) => {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return file ? [file] : [];
  });
}

export const carriesFiles = (data: DataTransfer | null): boolean =>
  data !== null && Array.from(data.types).includes('Files');
