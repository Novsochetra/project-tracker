import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { Icon } from '../../components';
import { RemoveButton } from './RemoveButton';
import { FileFace, ImageFace, VideoFace } from './thumbnailFaces';
import faces from './thumbnailFaces.module.css';
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

// Where the ring was: the note that says why may be out of sight, below the files.
function UploadStatus({ file, overMedia }: { file: UploadingFile; overMedia: boolean }) {
  if (!file.failed) {
    return (
      <UploadProgress
        progress={file.progress}
        label={`Uploading ${file.name}`}
        overMedia={overMedia}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${file.name} didn't upload`}
      className={clsx(faces.failed, overMedia && faces.overMedia)}
    >
      <Icon icon={CircleAlert} size={20} />
    </span>
  );
}

export function UploadThumbnail({ file, onCancel }: UploadThumbnailProps) {
  const wide = isWide(file.kind);
  const progress = <UploadStatus file={file} overMedia={!wide} />;
  return (
    <div className={clsx(styles.tile, wide && styles.wide, file.failed && styles.failed)}>
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
