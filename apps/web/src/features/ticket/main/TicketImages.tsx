import type { Attachment } from '@tracker/shared';
import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../../../components';
import {
  AddImageTile,
  ImageFileInput,
  ThumbnailGrid,
  toViewerImages,
  useImageViewer,
  type ImageUploads,
} from '../../attachments';
import { RemoveImageConfirm } from './RemoveImageConfirm';
import styles from './TicketMain.module.css';
import { useImageRemoval } from './useImageRemoval';

export interface TicketImagesProps {
  ticketKey: string;
  images: Attachment[];
  uploads: ImageUploads;
}

export function TicketImages({ ticketKey, images, uploads }: TicketImagesProps) {
  const viewer = useImageViewer();
  const removal = useImageRemoval(ticketKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const empty = images.length === 0 && uploads.uploading === 0;
  return (
    <>
      {empty ? (
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
        </div>
      ) : (
        <ThumbnailGrid
          images={images}
          uploading={uploads.uploading}
          onOpen={(index) => viewer.open(toViewerImages(images), index)}
          onRemove={removal.ask}
          markedId={removal.asking ? removal.target?.id : null}
          className={styles.images}
        >
          <AddImageTile onClick={pick} />
        </ThumbnailGrid>
      )}
      <ImageFileInput ref={inputRef} label="Add images to ticket" onFiles={uploads.add} />
      {/* Stays mounted when the last image goes, so the phone sheet can finish closing. */}
      <RemoveImageConfirm removal={removal} />
    </>
  );
}
