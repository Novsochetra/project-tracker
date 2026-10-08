import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../../components';
import { AddImageTile, ImageFileInput, ThumbnailGrid } from '../attachments';
import styles from './CaptureSheet.module.css';
import type { CapturePhotos } from './useCapturePhotos';

/** Photos from the camera or library; on phones the picker offers both. */
export function CapturePhotoRow({ photos }: { photos: CapturePhotos }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const empty = photos.items.length === 0 && photos.uploading === 0;
  return (
    <div className={styles.photos}>
      {empty ? (
        <Button
          variant="text"
          size="sm"
          icon={ImagePlus}
          className={styles.addPhotos}
          onClick={pick}
        >
          Add photos
        </Button>
      ) : (
        <ThumbnailGrid
          size="sm"
          images={photos.items}
          uploading={photos.uploading}
          onRemove={photos.remove}
        >
          <AddImageTile aria-label="Add photos" onClick={pick} />
        </ThumbnailGrid>
      )}
      <ImageFileInput ref={inputRef} label="Add photos to ticket" onFiles={photos.add} />
    </div>
  );
}
