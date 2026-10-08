import clsx from 'clsx';
import { CircleAlert, X } from 'lucide-react';
import { useEffect, useState, type MouseEvent, type Ref } from 'react';
import { Icon, IconButton } from '../../components';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { useLatest } from '../../lib/useLatest';
import styles from './FileNote.module.css';
import {
  noticeDetail,
  noticeTitle,
  NOTICE_PROBLEMS,
  type FileNotice,
  type Notices,
} from './fileNotice';

export interface FileNoteProps {
  notice: FileNotice;
  onDismiss: () => void;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement>;
}

// What lies under the note slid up under the finger as it went, and the second tap of a double tap
// on Dismiss pressed it: a draft file's x, the ticket screen's x, or Comment. So a tap hides the
// note at once, but it keeps its place and takes no taps for CLICK_SHIELD_MS. A key press moves
// nothing under a finger, so it dismisses at once.
function useDismiss(notice: FileNotice, onDismiss: () => void) {
  const [leaving, setLeaving] = useState<FileNotice | null>(null);
  const dismiss = useLatest(onDismiss);
  const gone = leaving === notice;
  useEffect(() => {
    if (!gone) return;
    const timer = setTimeout(() => dismiss.current(), CLICK_SHIELD_MS);
    return () => clearTimeout(timer);
  }, [gone, dismiss]);
  const press = (event: MouseEvent) => {
    if (event.detail === 0) onDismiss();
    else setLeaving(notice);
  };
  return { gone, press };
}

export function FileNote({ notice, onDismiss, className, ref }: FileNoteProps) {
  const { gone, press } = useDismiss(notice, onDismiss);
  return (
    <div
      ref={ref}
      role="alert"
      inert={gone}
      className={clsx(styles.note, 'fade-in', gone && styles.gone, className)}
    >
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
        onClick={press}
      />
    </div>
  );
}

export interface FileNotesProps {
  notices: Notices;
  onDismiss: (problem: FileNotice['problem']) => void;
  className?: string | undefined;
}

// Both notes in one place, where there is no room to keep them apart (the comment box).
export function FileNotes({ notices, onDismiss, className }: FileNotesProps) {
  return NOTICE_PROBLEMS.map((problem) => {
    const notice = notices[problem];
    if (!notice) return null;
    return (
      <FileNote
        key={problem}
        notice={notice}
        onDismiss={() => onDismiss(problem)}
        className={className}
      />
    );
  });
}
