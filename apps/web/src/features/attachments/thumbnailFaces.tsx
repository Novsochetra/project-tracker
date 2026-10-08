import { formatBytes, type AttachmentKind } from '@tracker/shared';
import { File, FileImage, FileText, Film, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Icon } from '../../components';
import styles from './thumbnailFaces.module.css';
import { formatDuration, splitFileName } from './thumbnailLabels';

export function ImageFace({ src, alt = '' }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  // A photo this browser can't show (HEIC outside Safari) gets an icon, never a broken image.
  if (failed) return <Icon icon={FileImage} size={20} className={styles.fallback} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={styles.cover}
      onError={() => setFailed(true)}
    />
  );
}

export interface VideoFaceProps {
  src: string;
  // Off while the file uploads: the progress takes the middle then.
  playBadge?: boolean;
}

// The first frame stands in for a poster: iOS draws it only for a time in the address (#t).
// Until a frame is drawn, or when this browser can't play the video, a film icon shows.
export function VideoFace({ src, playBadge = true }: VideoFaceProps) {
  const [duration, setDuration] = useState<string | null>(null);
  const [framed, setFramed] = useState(false);
  return (
    <>
      {!framed && <Icon icon={Film} size={20} className={styles.fallback} />}
      <video
        className={styles.cover}
        src={`${src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
        onLoadedMetadata={(event) => setDuration(formatDuration(event.currentTarget.duration))}
        onLoadedData={() => setFramed(true)}
      />
      {framed && playBadge && (
        <span className={styles.play} aria-hidden="true">
          <Play size={10} fill="currentColor" strokeWidth={0} />
        </span>
      )}
      {duration && <span className={styles.duration}>{duration}</span>}
    </>
  );
}

export interface FileFaceProps {
  kind: AttachmentKind | null;
  name: string;
  size: number;
  lead?: ReactNode;
}

// In two parts so a small tile can shorten the first; the title shows a shortened name whole.
function FileName({ name }: { name: string }) {
  const { head, tail } = splitFileName(name);
  return (
    <span className={styles.fileName} title={name}>
      <span className={styles.nameText}>
        <span className={styles.nameHead}>{head}</span>
        <span className={styles.nameTail}>{tail}</span>
      </span>
    </span>
  );
}

export function FileFace({ kind, name, size, lead }: FileFaceProps) {
  return (
    <span className={styles.file}>
      {lead ?? <Icon icon={kind === 'text' ? FileText : File} size={20} className={styles.icon} />}
      <span className={styles.fileText}>
        <FileName name={name} />
        <span className={styles.fileSize}>{formatBytes(size)}</span>
      </span>
    </span>
  );
}
