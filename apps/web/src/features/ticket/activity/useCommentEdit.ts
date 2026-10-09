import { useState } from 'react';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  rebaseDraft,
  storedDraft,
  type DraftTarget,
} from '../../../lib/storedDrafts';
import { useLiveDraft } from '../drafts/liveDrafts';
import { afterTyping, isOpen, restoredEdit, saveStep, STARTED, withPhase } from './commentEdit';
import type { ActivityActions } from './useActivityActions';
import { useEditSending } from './useEditSending';

export interface CommentEdit {
  open: boolean;
  closed: boolean;
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

interface Comment {
  id: string;
  text: string;
}

export function useCommentEdit(
  comment: Comment,
  editComment: ActivityActions['editComment'],
  ticketKey: string,
): CommentEdit {
  const target: DraftTarget = { ticketKey, field: 'comment-edit', activityId: comment.id };
  const id = draftIdOf(target);
  const [restored] = useState(() => storedDraft(id));
  const [edit, setEdit] = useState(() => restoredEdit(restored));
  const [reopened, setReopened] = useState(restored !== undefined);
  const [text, setText] = useState(restored?.text ?? comment.text);
  const [startedFrom, setStartedFrom] = useState(comment.text);
  const sending = useEditSending({
    id,
    target,
    base: startedFrom,
    edit,
    text,
    setEdit,
    editComment: (value, expected) => editComment(comment.id, value, expected),
  });
  useLiveDraft(id, () => {
    if (edit.phase === 'failed') sending.retry();
  });
  const close = () => {
    forgetDraft(id);
    setEdit((current) => withPhase(current, 'closed'));
  };
  const save = () => {
    switch (saveStep(edit, text, comment.text)) {
      case 'ignore':
        return;
      case 'close':
        return close();
      case 'replace':
        rebaseDraft(id, comment.text);
        return sending.send(text);
      case 'send':
        return sending.send(text);
      case 'check':
        return sending.sendChecked(text);
    }
  };

  return {
    open: isOpen(edit),
    closed: edit.phase === 'closed',
    restored: reopened,
    text,
    saving: edit.phase === 'saving',
    failed: edit.phase === 'failed',
    changed: edit.phase === 'changed',
    setText: (next) => {
      // An emptied edit can't be saved (a comment needs text), so it isn't kept either. A
      // refused one still says so after a reload.
      const changed = edit.phase === 'changed' || undefined;
      if (next.trim()) keepDraft(id, { ...target, text: next, changed }, startedFrom);
      else forgetDraft(id);
      setText(next);
      setEdit(afterTyping);
    },
    start: () => {
      setText(comment.text);
      setStartedFrom(comment.text);
      setReopened(false);
      setEdit(STARTED);
    },
    cancel: close,
    save,
  };
}
