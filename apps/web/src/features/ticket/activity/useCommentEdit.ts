import { useRef, useState } from 'react';
import {
  draftIdOf,
  draftSaved,
  forgetDraft,
  keepDraft,
  rebaseDraft,
  storedDraft,
  type DraftTarget,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useLiveDraft } from '../drafts/liveDrafts';
import { useDraftCheck } from '../drafts/useDraftCheck';
import type { ActivityActions } from './useActivityActions';

type EditPhase = 'idle' | 'editing' | 'saving' | 'failed' | 'changed' | 'closed';

export interface CommentEdit {
  open: boolean;
  // The editor was open and has closed, so focus can move on to the options button.
  closed: boolean;
  text: string;
  saving: boolean;
  failed: boolean;
  // The comment changed elsewhere while the edit wasn't saved; Save replaces it, Cancel keeps it.
  changed: boolean;
  setText: (text: string) => void;
  start: () => void;
  cancel: () => void;
  save: () => void;
}

const OPEN_PHASES: ReadonlySet<EditPhase> = new Set(['editing', 'saving', 'failed', 'changed']);

// Typing over a save in flight or a failed one starts a new edit, which Save has to send.
const afterTyping = (phase: EditPhase): EditPhase =>
  phase === 'saving' || phase === 'failed' ? 'editing' : phase;

// The editor stays open until the edit is saved, and a failed edit reopens it with its text.
const afterSave = (phase: EditPhase, saved: boolean): EditPhase => {
  if (!saved) return 'failed';
  return phase === 'saving' ? 'closed' : phase;
};

interface Comment {
  id: string;
  text: string;
}

interface RetryInput {
  phase: EditPhase;
  save: () => void;
  setPhase: (phase: EditPhase) => void;
}

// A failed edit is saved again only while the comment still reads as it did before the edit.
function useEditRetry(id: string, ticketKey: string, edit: RetryInput): void {
  const check = useDraftCheck(ticketKey);
  const latest = useLatest(edit);
  const checkingRef = useRef(false);
  useLiveDraft(id, () => {
    if (edit.phase !== 'failed' || checkingRef.current) return;
    checkingRef.current = true;
    void check(id).then((result) => {
      checkingRef.current = false;
      const now = latest.current;
      if (now.phase !== 'failed' || result === null || result === 'unreachable') return;
      if (result === 'unchanged') now.save();
      else if (result === 'changed') now.setPhase('changed');
      else {
        forgetDraft(id);
        now.setPhase('closed');
      }
    });
  });
}

export function useCommentEdit(
  comment: Comment,
  editComment: ActivityActions['editComment'],
  ticketKey: string,
): CommentEdit {
  const target: DraftTarget = { ticketKey, field: 'comment-edit', activityId: comment.id };
  const id = draftIdOf(target);
  // An edit kept from an earlier visit opens the editor with its text and note.
  const [restored] = useState(() => storedDraft(id));
  const [phase, setPhase] = useState<EditPhase>(restored ? 'failed' : 'idle');
  const [text, setText] = useState(restored?.text ?? comment.text);
  const [startedFrom, setStartedFrom] = useState(comment.text);
  const keep = (value: string) => keepDraft(id, { ...target, text: value }, startedFrom);

  const send = () => {
    setPhase('saving');
    void editComment(comment.id, text).then((saved) => {
      if (saved) draftSaved(id, text);
      // Cancelling mid-save dropped the kept text, but a failed edit reopens the editor with it.
      else if (!storedDraft(id)) keep(text);
      setPhase((current) => afterSave(current, saved));
    });
  };
  const save = () => {
    if (phase === 'saving') return;
    if (text.trim() === comment.text) {
      forgetDraft(id);
      setPhase('closed');
      return;
    }
    if (phase === 'changed') rebaseDraft(id, comment.text);
    send();
  };
  useEditRetry(id, ticketKey, { phase, save, setPhase });

  return {
    open: OPEN_PHASES.has(phase),
    closed: phase === 'closed',
    text,
    saving: phase === 'saving',
    failed: phase === 'failed',
    changed: phase === 'changed',
    setText: (next) => {
      keep(next);
      setText(next);
      setPhase(afterTyping);
    },
    start: () => {
      setText(comment.text);
      setStartedFrom(comment.text);
      setPhase('editing');
    },
    cancel: () => {
      forgetDraft(id);
      setPhase('closed');
    },
    save,
  };
}
