import { attachmentKind, type Attachment, type AttachmentKind } from '@tracker/shared';
import clsx from 'clsx';
import { use, type ReactNode } from 'react';
import { RemoveButton } from './RemoveButton';
import { FileFace, ImageFace, VideoFace } from './thumbnailFaces';
import styles from './ThumbnailGrid.module.css';
import { capitalized, isWide } from './thumbnailLabels';
import { AttachmentViewerContext } from './viewerContext';

export interface SavedThumbnailProps {
  attachment: Attachment;
  label: string;
  marked: boolean;
  onOpen?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}

interface FaceProps {
  attachment: Attachment;
  kind: AttachmentKind | null;
  label: string;
  onOpen: (() => void) | undefined;
}

function OpenButton({
  name,
  className,
  onOpen,
  children,
}: {
  name: string;
  className: string | undefined;
  onOpen: () => void;
  children: ReactNode;
}) {
  const viewer = use(AttachmentViewerContext);
  return (
    <button
      type="button"
      className={clsx(styles.frame, styles.open, className)}
      aria-label={name}
      onPointerDown={viewer?.prepare}
      onKeyDown={viewer?.prepare}
      onClick={onOpen}
    >
      {children}
    </button>
  );
}

function MediaFace({ attachment, kind, label, onOpen }: FaceProps) {
  const isVideo = kind === 'video';
  const face = isVideo ? <VideoFace src={attachment.url} /> : <ImageFace src={attachment.url} />;
  if (onOpen) {
    const name = `${isVideo ? 'Play' : 'Open'} ${label}`;
    const zoom = isVideo ? undefined : styles.zoom;
    return (
      <OpenButton name={name} className={zoom} onOpen={onOpen}>
        {face}
      </OpenButton>
    );
  }
  if (isVideo) {
    return (
      <div className={styles.frame} role="img" aria-label={capitalized(label)}>
        {face}
      </div>
    );
  }
  return (
    <div className={styles.frame}>
      <ImageFace src={attachment.url} alt={capitalized(label)} />
    </div>
  );
}

function DocumentFace({ attachment, kind, label, onOpen }: FaceProps) {
  const face = <FileFace kind={kind} name={attachment.fileName} size={attachment.size} />;
  if (!onOpen) return <div className={clsx(styles.frame, styles.file)}>{face}</div>;
  if (kind === 'text') {
    return (
      <OpenButton name={`Open ${label}`} className={styles.file} onOpen={onOpen}>
        {face}
      </OpenButton>
    );
  }
  // The browser shows PDFs best itself, in a tab of their own.
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${label}`}
      className={clsx(styles.frame, styles.open, styles.file)}
    >
      {face}
    </a>
  );
}

export function SavedThumbnail({
  attachment,
  label,
  marked,
  onOpen,
  onRemove,
}: SavedThumbnailProps) {
  const kind = attachmentKind(attachment.mimeType);
  const props: FaceProps = { attachment, kind, label, onOpen };
  return (
    <div className={clsx(styles.tile, isWide(kind) && styles.wide, marked && styles.marked)}>
      {isWide(kind) ? <DocumentFace {...props} /> : <MediaFace {...props} />}
      {onRemove && <RemoveButton label={`Remove ${label}`} onRemove={onRemove} />}
    </div>
  );
}
