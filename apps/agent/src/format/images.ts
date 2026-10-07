import type { Attachment } from '@tracker/shared';
import { formatBytes, SEP } from './text';

export function describeImage(image: Attachment): string {
  const parts = [image.fileName, formatBytes(image.size)];
  if (image.width && image.height) parts.push(`${image.width}×${image.height}`);
  return parts.join(SEP);
}

export const formatImageList = (images: readonly Attachment[]): string[] =>
  images.map((image) => `- ${describeImage(image)}`);
