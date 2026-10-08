import { useState } from 'react';
import { useDraftMark } from '../fields/useDraftMark';
import { useRetryWhenOnline } from '../fields/useRetryWhenOnline';
import type { ActivityActions } from './useActivityActions';

type EditPhase = 'idle' | 'editing' | 'saving' | 'failed' | 'closed';

export interface CommentEdit {
  open: boolean;
  /** The editor was open and has closed, so focus can move on to the options button. */
  closed: boolean;
  text: string;
  saving: boolean;
  failed: boolean;
  setText: (text: string) => void;
  start: () => void;
  cancel: () => void;
  save: () => void;
}

const OPEN_PHASES: ReadonlySet<EditPhase> = new Set(['editing', 'saving', 'failed']);

// Typing over a save in flight or a failed one starts a new edit, which Save has to send.
const afterTyping = (phase: EditPhase): EditPhase =>
  phase === 'saving' || phase === 'failed' ? 'editing' : phase;

// The editor stays open until the edit is saved, and a failed edit reopens it with its text.
const afterSave = (phase: EditPhase, saved: boolean): EditPhase => {
  if (!saved) return 'failed';
  return phase === 'saving' ? 'closed' : phase;
};

export function useCommentEdit(
  comment: { id: string; text: string },
  editComment: ActivityActions['editComment'],
): CommentEdit {
  const [phase, setPhase] = useState<EditPhase>('idle');
  const [text, setText] = useState(comment.text);
  const open = OPEN_PHASES.has(phase);
  const save = () => {
    if (phase === 'saving') return;
    if (text.trim() === comment.text) {
      setPhase('closed');
      return;
    }
    setPhase('saving');
    void editComment(comment.id, text).then((saved) =>
      setPhase((current) => afterSave(current, saved)),
    );
  };
  useRetryWhenOnline(phase === 'failed', save);
  useDraftMark(`comment-edit:${comment.id}`, phase === 'failed' || (open && text !== comment.text));
  return {
    open,
    closed: phase === 'closed',
    text,
    saving: phase === 'saving',
    failed: phase === 'failed',
    setText: (next) => {
      setText(next);
      setPhase(afterTyping);
    },
    start: () => {
      setText(comment.text);
      setPhase('editing');
    },
    cancel: () => setPhase('closed'),
    save,
  };
}
