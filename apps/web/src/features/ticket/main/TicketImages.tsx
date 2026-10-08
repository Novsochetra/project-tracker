import type { Attachment } from '@tracker/shared';
import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { errorMessage, useDeleteAttachment } from '../../../api';
import { Button, useToast } from '../../../components';
import {
  AddImageTile,
  ImageFileInput,
  ThumbnailGrid,
  toViewerImages,
  useImageViewer,
  type ImageUploads,
} from '../../attachments';
import styles from './TicketMain.module.css';

export interface TicketImagesProps {
  ticketKey: string;
  images: Attachment[];
  uploads: ImageUploads;
}

export function TicketImages({ ticketKey, images, uploads }: TicketImagesProps) {
  const viewer = useImageViewer();
  const removeAttachment = useDeleteAttachment();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const input = (
    <ImageFileInput ref={inputRef} label="Add images to ticket" onFiles={uploads.add} />
  );

  if (images.length === 0 && uploads.uploading === 0) {
    return (
      <div className={styles.addRow}>
        <Button
          variant="text"
          size="sm"
          icon={ImagePlus}
          className={styles.addImages}
          onClick={pick}
        >
          Add images
        </Button>
        {input}
      </div>
    );
  }
  const remove = (attachmentId: string) => {
    void removeAttachment
      .mutateAsync({ attachmentId, ticketKey })
      .catch((error: unknown) => show(errorMessage(error)));
  };
  return (
    <>
      <ThumbnailGrid
        images={images}
        uploading={uploads.uploading}
        onOpen={(index) => viewer.open(toViewerImages(images), index)}
        onRemove={remove}
        className={styles.images}
      >
        <AddImageTile onClick={pick} />
      </ThumbnailGrid>
      {input}
    </>
  );
}
