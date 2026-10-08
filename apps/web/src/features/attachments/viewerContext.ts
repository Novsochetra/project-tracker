import type { Attachment } from '@tracker/shared';
import { createContext, use } from 'react';
import type { ViewerImage } from '../../overlays';
import { capitalized, thumbnailLabels } from './thumbnailLabels';

export interface AttachmentViewerApi {
  open: (attachments: readonly Attachment[], index: number) => void;
}

export const AttachmentViewerContext = createContext<AttachmentViewerApi | null>(null);

export function useAttachmentViewer(): AttachmentViewerApi {
  const api = use(AttachmentViewerContext);
  if (!api) throw new Error('useAttachmentViewer needs an <AttachmentViewerProvider> above it.');
  return api;
}

export const toViewerImages = (images: readonly Attachment[]): ViewerImage[] => {
  const labels = thumbnailLabels(images);
  return images.map((image, index) => ({
    id: image.id,
    url: image.url,
    alt: capitalized(labels[index] ?? image.fileName),
    ...(image.width && image.height ? { width: image.width, height: image.height } : {}),
  }));
};
