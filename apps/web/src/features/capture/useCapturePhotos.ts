import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { useDeleteAttachment } from '../../api';
import { useImageUploads } from '../attachments';

export interface CapturePhotos {
  items: Attachment[];
  uploading: number;
  add: (files: Iterable<File>) => void;
  remove: (attachmentId: string) => void;
}

/** Photos upload right away and wait on the server until the ticket is created with them. */
export function useCapturePhotos(): CapturePhotos {
  const [items, setItems] = useState<Attachment[]>([]);
  const uploads = useImageUploads({
    onUploaded: (photo) => setItems((current) => [...current, photo]),
  });
  const deleteAttachment = useDeleteAttachment();
  const remove = (attachmentId: string) => {
    setItems((current) => current.filter((photo) => photo.id !== attachmentId));
    // Unused uploads expire on the server anyway, so a failed cleanup needs no message.
    deleteAttachment.mutate({ attachmentId });
  };
  return { items, uploading: uploads.uploading, add: uploads.add, remove };
}
