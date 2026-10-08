import clsx from 'clsx';
import styles from './thumbnailFaces.module.css';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const WAITING_ARC = 0.25;

export interface UploadProgressProps {
  progress: number;
  label: string;
  overMedia: boolean;
}

export function UploadProgress({ progress, label, overMedia }: UploadProgressProps) {
  const percent = Math.round(progress * 100);
  const known = percent > 0;
  const shown = known ? progress : WAITING_ARC;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
      className={clsx(styles.progress, overMedia && styles.overMedia, !known && styles.waiting)}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r={RADIUS} className={styles.track} />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          className={styles.arc}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
        />
      </svg>
    </span>
  );
}
