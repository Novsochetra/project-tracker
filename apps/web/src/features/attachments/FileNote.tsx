import clsx from 'clsx';
import { CircleAlert, X } from 'lucide-react';
import type { Ref } from 'react';
import { Icon, IconButton } from '../../components';
import styles from './FileNote.module.css';
import { noticeDetail, noticeTitle, type FileNotice } from './fileNotice';

export interface FileNoteProps {
  notice: FileNotice;
  onDismiss: () => void;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement>;
}

export function FileNote({ notice, onDismiss, className, ref }: FileNoteProps) {
  return (
    <div ref={ref} role="alert" className={clsx(styles.note, 'fade-in', className)}>
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
