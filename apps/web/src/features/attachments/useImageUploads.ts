import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { errorMessage, useUploadAttachment } from '../../api';
import { useToast } from '../../components';
import { partitionImages, UNSUPPORTED_IMAGE_MESSAGE } from './imageFiles';

export interface ImageUploadOptions {
  /** Attaches the images to this ticket. Without it they stay pending until a comment uses them. */
  ticketKey?: string | undefined;
  onUploaded?: (attachment: Attachment) => void;
}

export interface ImageUploads {
  uploading: number;
  add: (files: Iterable<File>) => void;
}

export function useImageUploads({ ticketKey, onUploaded }: ImageUploadOptions = {}): ImageUploads {
  const upload = useUploadAttachment();
  const { show } = useToast();
  const [uploading, setUploading] = useState(0);

  const add = (files: Iterable<File>) => {
    const { images, rejected } = partitionImages(files);
    if (rejected.length > 0) show(UNSUPPORTED_IMAGE_MESSAGE);
    if (images.length === 0) return;
    setUploading((count) => count + images.length);
    for (const file of images) {
      // mutateAsync, because callbacks passed to mutate only run for the latest call.
      void upload
        .mutateAsync({ file, ticketKey })
        .then(onUploaded, (error: unknown) => show(errorMessage(error)))
        .finally(() => setUploading((count) => count - 1));
    }
  };

  return { uploading, add };
}
