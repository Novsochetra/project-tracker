import clsx from 'clsx';
import { CircleAlert, X } from 'lucide-react';
import { useRef, type MouseEvent, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { Icon, IconButton } from '../../components';
import styles from './FileNote.module.css';
import { controlsAfter, focusFirst } from './focusAfter';
import {
  noticeDetail,
  noticeTitle,
  NOTICE_PROBLEMS,
  type FileNotice,
  type Notices,
} from './fileNotice';
import { holdPresses } from './holdPresses';
import { useToastIfUnseen } from './useToastIfUnseen';

export interface FileNoteProps {
  notice: FileNotice;
  onDismiss: () => void;
  // Where focus goes when a key press or VoiceOver dismisses the note; else to the next control.
  focusTo?: (() => HTMLElement | null) | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement>;
}

// A note that kept its place for a moment after a tap, then closed in one jump, moved files under a
// tap aimed at what the gap showed (PT-95). So it goes with the tap, and the page holds back a
// pointer's presses while what moved settles under the finger (holdPresses). A key press, or
// VoiceOver's click with no pointer before it (PT-101), moves nothing under a finger, but the focus
// it takes away with the note would fall to the page body. Focus moves once the note has gone: the
// failed tiles go with it, and when they were the only ones the Add tile gives way to the Add files
// button.
function useDismissal(onDismiss: () => void, focusTo: FileNoteProps['focusTo']) {
  const pointerDown = useRef(false);
  const dismissFromFocus = (button: HTMLButtonElement) => {
    const next = controlsAfter(button.closest('[role="alert"]') ?? button);
    flushSync(onDismiss);
    focusFirst([focusTo?.(), ...next]);
  };
  return {
    onPointerDown: () => {
      pointerDown.current = true;
    },
    onPointerCancel: () => {
      pointerDown.current = false;
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      // A key's click (detail 0) after a press that ended off the button finds a pointer down.
      const byPointer = pointerDown.current && event.detail !== 0;
      pointerDown.current = false;
      if (!byPointer) {
        dismissFromFocus(event.currentTarget);
        return;
      }
      holdPresses(event.currentTarget);
      onDismiss();
    },
  };
}

export function FileNote({ notice, onDismiss, focusTo, className, ref }: FileNoteProps) {
  const dismissal = useDismissal(onDismiss, focusTo);
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
        {...dismissal}
      />
    </div>
  );
}

export interface FileNotesProps {
  notices: Notices;
  onDismiss: (problem: FileNotice['problem']) => void;
  className?: string | undefined;
}

// Both notes in one place, where there is no room to keep them apart (the comment box). It keeps no
// failed tile, and its notes sit below the files, so from the top of many files an upload that
// fails late is said in a toast too, as in the file pickers (PT-101).
export function FileNotes({ notices, onDismiss, className }: FileNotesProps) {
  const lateRef = useRef<HTMLDivElement>(null);
  useToastIfUnseen(lateRef, notices.failed);
  return NOTICE_PROBLEMS.map((problem) => {
    const notice = notices[problem];
    if (!notice) return null;
    return (
      <FileNote
        key={problem}
        ref={problem === 'failed' ? lateRef : undefined}
        notice={notice}
        onDismiss={() => onDismiss(problem)}
        className={className}
      />
    );
  });
}
