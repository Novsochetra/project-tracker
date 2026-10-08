import { useRef, useState } from 'react';
import {
  draftIdOf,
  draftSaved,
  forgetDraft,
  keepDraft,
  rebaseDraft,
  storedDraft,
  type DraftTarget,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useLiveDraft } from '../drafts/liveDrafts';
import { useDraftCheck } from '../drafts/useDraftCheck';
import { useDraftSave } from '../drafts/useDraftSave';
import type { ActivityActions } from './useActivityActions';

type EditPhase = 'idle' | 'editing' | 'saving' | 'failed' | 'changed' | 'closed';

export interface CommentEdit {
  open: boolean;
  // The editor was open and has closed, so focus can move on to the options button.
  closed: boolean;
  // Opened again from a kept draft, not by the user just now, so it doesn't take focus.
  restored: boolean;
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

// An edit whose Save failed opens failed and is retried. One nobody saved opens as it was left
// and is only ever sent by Save.
const restoredPhase = (kept: StoredDraft | undefined): EditPhase => {
  if (!kept) return 'idle';
  return kept.submitted ? 'failed' : 'editing';
};

// Typing over a save in flight or a failed one starts a new edit, which Save has to send.
const afterTyping = (phase: EditPhase): EditPhase =>
  phase === 'saving' || phase === 'failed' ? 'editing' : phase;

// The editor stays open until the edit is saved, and a failed edit reopens it with its text.
// Text typed since Save was pressed is a new edit, which waits for Save.
const afterSave = (phase: EditPhase, saved: boolean): EditPhase => {
  if (saved) return phase === 'saving' ? 'closed' : phase;
  return phase === 'editing' ? 'editing' : 'failed';
};

interface Comment {
  id: string;
  text: string;
}

interface RetryInput {
  phase: EditPhase;
  save: (quiet: boolean) => void;
  setPhase: (phase: EditPhase) => void;
}

// A failed edit is saved again, quietly, only while the comment still reads as it did before.
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
      if (result === 'unchanged') now.save(true);
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
  const [restored] = useState(() => storedDraft(id));
  const [phase, setPhase] = useState<EditPhase>(() => restoredPhase(restored));
  const [reopened, setReopened] = useState(restored !== undefined);
  const [text, setText] = useState(restored?.text ?? comment.text);
  const [startedFrom, setStartedFrom] = useState(comment.text);
  const saveDraft = useDraftSave();
  // Once Save is pressed, the app may send the text for the user until it is saved.
  const submit = () => keepDraft(id, { ...target, text, submitted: true }, startedFrom);

  const send = (quiet: boolean) => {
    submit();
    setPhase('saving');
    const request = quiet
      ? saveDraft({ ...target, text, base: startedFrom }).then(
          () => true,
          () => false,
        )
      : editComment(comment.id, text);
    void request.then((saved) => {
      if (saved) draftSaved(id, text);
      // Cancelling mid-save dropped the kept text, but a failed edit reopens the editor with it.
      else if (!storedDraft(id)) submit();
      setPhase((current) => afterSave(current, saved));
    });
  };
  const save = (quiet = false) => {
    if (phase === 'saving') return;
    if (text.trim() === comment.text) {
      forgetDraft(id);
      setPhase('closed');
      return;
    }
    if (phase === 'changed') rebaseDraft(id, comment.text);
    send(quiet);
  };
  useEditRetry(id, ticketKey, { phase, save, setPhase });

  return {
    open: OPEN_PHASES.has(phase),
    closed: phase === 'closed',
    restored: reopened,
    text,
    saving: phase === 'saving',
    failed: phase === 'failed',
    changed: phase === 'changed',
    setText: (next) => {
      // An emptied edit can't be saved (a comment needs text), so it isn't kept either.
      if (next.trim()) keepDraft(id, { ...target, text: next }, startedFrom);
      else forgetDraft(id);
      setText(next);
      setPhase(afterTyping);
    },
    start: () => {
      setText(comment.text);
      setStartedFrom(comment.text);
      setReopened(false);
      setPhase('editing');
    },
    cancel: () => {
      forgetDraft(id);
      setPhase('closed');
    },
    save: () => save(),
  };
}
