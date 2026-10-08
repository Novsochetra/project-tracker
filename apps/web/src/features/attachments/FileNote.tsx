import clsx from 'clsx';
import { CircleAlert, X } from 'lucide-react';
import { Icon, IconButton } from '../../components';
import styles from './FileNote.module.css';
import { noticeDetail, noticeTitle, type FileNotice } from './fileNotice';

export interface FileNoteProps {
  notice: FileNotice;
  onDismiss: () => void;
  className?: string | undefined;
}

export function FileNote({ notice, onDismiss, className }: FileNoteProps) {
  return (
    <div role="alert" className={clsx(styles.note, 'fade-in', className)}>
      <Icon icon={CircleAlert} size={14} className={styles.icon} />
      <p className={styles.text}>
        <span className={styles.title}>{noticeTitle(notice)}</span>
        <span className={styles.detail}>{noticeDetail(notice)}</span>
      </p>
      <IconButton
        aria-label="Dismiss"
        icon={X}
        size="xs"
        className={styles.dismiss}
        onClick={onDismiss}
      />
    </div>
  );
}
