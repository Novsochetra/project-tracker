import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { Icon } from '../../../components';
import styles from './UnsavedNote.module.css';

export interface UnsavedNoteProps {
  /** What isn't saved, as it starts a sentence: "Title", "Your edit". */
  subject: string;
  /** Names the message, for the field's aria-describedby. */
  id?: string | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

export function UnsavedNote({ subject, id, onRetry, className }: UnsavedNoteProps) {
  return (
    <p role="alert" className={clsx(styles.note, 'fade-in', className)}>
      <Icon icon={CircleAlert} size={14} className={styles.icon} />
      <span id={id}>{`${subject} isn't saved yet.`}</span>
      {onRetry && (
        <button
          type="button"
          className={styles.retry}
          aria-label={`Retry saving ${subject.toLowerCase()}`}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </p>
  );
}
