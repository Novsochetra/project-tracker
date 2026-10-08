import type { Attachment } from '@tracker/shared';
import { createContext, use } from 'react';
import type { ViewerImage } from '../../overlays';

export interface ImageViewerApi {
  open: (images: ViewerImage[], index: number) => void;
}

export const ImageViewerContext = createContext<ImageViewerApi | null>(null);

export function useImageViewer(): ImageViewerApi {
  const api = use(ImageViewerContext);
  if (!api) throw new Error('useImageViewer needs an <ImageViewerProvider> above it.');
  return api;
}

export const toViewerImages = (images: readonly Attachment[]): ViewerImage[] =>
  images.map((image, index) => ({
    id: image.id,
    url: image.url,
    alt: `Attachment ${index + 1}`,
    ...(image.width && image.height ? { width: image.width, height: image.height } : {}),
  }));
