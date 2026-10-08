import clsx from 'clsx';
import { CircleAlert, X } from 'lucide-react';
import type { MouseEvent, Ref } from 'react';
import { Icon, IconButton } from '../../components';
import styles from './FileNote.module.css';
import { focusAfter } from './focusAfter';
import {
  noticeDetail,
  noticeTitle,
  NOTICE_PROBLEMS,
  type FileNotice,
  type Notices,
} from './fileNotice';
import { holdPresses } from './holdPresses';

export interface FileNoteProps {
  notice: FileNotice;
  onDismiss: () => void;
  // Where focus goes when a key press dismisses the note; else to the next control after it.
  focusTo?: (() => HTMLElement | null) | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement>;
}

// A note that kept its place for a moment after a tap, then closed in one jump, moved files under a
// tap aimed at what the gap showed (PT-95). So it goes with the tap, and the page holds back a
// pointer's presses while what moved settles under the finger (holdPresses). A key press moves
// nothing under a finger, but the focus it takes away with the note would fall to the page body.
function dismissal(onDismiss: () => void, focusTo: FileNoteProps['focusTo']) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    else {
      const target = focusTo?.();
      if (target) target.focus();
      else focusAfter(event.currentTarget.closest('[role="alert"]') ?? event.currentTarget);
    }
    onDismiss();
  };
}

export function FileNote({ notice, onDismiss, focusTo, className, ref }: FileNoteProps) {
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
        onClick={dismissal(onDismiss, focusTo)}
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
