import clsx from 'clsx';
import { RemoveButton } from './RemoveButton';
import { FileFace, ImageFace, VideoFace } from './thumbnailFaces';
import styles from './ThumbnailGrid.module.css';
import { isWide } from './thumbnailLabels';
import { UploadProgress } from './UploadProgress';
import type { UploadingFile } from './useAttachmentUploads';

export interface UploadThumbnailProps {
  file: UploadingFile;
  onCancel?: (() => void) | undefined;
}

function LocalPreview({ file }: { file: UploadingFile }) {
  if (!file.preview) return null;
  if (file.kind === 'video') return <VideoFace src={file.preview} playBadge={false} />;
  return <ImageFace src={file.preview} />;
}

/** A file on its way to the tracker, shown from the file itself while it goes. */
export function UploadThumbnail({ file, onCancel }: UploadThumbnailProps) {
  const wide = isWide(file.kind);
  const progress = (
    <UploadProgress progress={file.progress} label={`Uploading ${file.name}`} overMedia={!wide} />
  );
  return (
    <div className={clsx(styles.tile, wide && styles.wide)}>
      {wide ? (
        <div className={clsx(styles.frame, styles.file)}>
          <FileFace kind={file.kind} name={file.name} size={file.size} lead={progress} />
        </div>
      ) : (
        <div className={styles.frame}>
          <LocalPreview file={file} />
          {progress}
        </div>
      )}
      {onCancel && <RemoveButton label={`Remove ${file.name}`} onRemove={onCancel} />}
    </div>
  );
}
