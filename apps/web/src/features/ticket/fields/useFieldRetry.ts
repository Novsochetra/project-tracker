import { useRef, type Dispatch, type SetStateAction } from 'react';
import { NETWORK_ERROR_MESSAGE } from '../../../api';
import { useToast } from '../../../components';
import { draftSaved, forgetDraft, storedDraft } from '../../../lib/storedDrafts';
import { retryLiveDraft } from '../drafts/liveDrafts';
import { useDraftCheck, useFreshTicket, type CheckResult } from '../drafts/useDraftCheck';
import { checkedDraft, supersededDraft, type FieldDraft } from './fieldDraft';
import { isSavingAnywhere, savingWhere, whenSettled } from './fieldSaves';
import type { FieldTarget, SaveField } from './useFieldSave';

export interface RetryInput {
  id: string;
  target: FieldTarget;
  draft: FieldDraft;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  save: SaveField;
}

// While the field is on screen. A task later, because the retry reads the field's state, which
// shows a refused save once it renders.
export const retryOnceSettled = (id: string) =>
  whenSettled(id, () => setTimeout(() => retryLiveDraft(id)));

// The user's Retry says when the tracker can't be reached. Retries the app starts on its own
// stay quiet, also when their save fails: the field's note already says it isn't saved.
export type RetryBy = 'user' | 'app';

// Saves the newest typed text; none is kept when the user dropped it while the check ran.
function settleCheck(input: RetryInput, shown: string, result: CheckResult, by: RetryBy) {
  const { id, setDraft, save } = input;
  const kept = storedDraft(id);
  if (result === 'unchanged' && kept) {
    void save(kept.text, { checked: true, quiet: by === 'app' });
  } else if (result === 'gone') forgetDraft(id);
  else if (result === 'saved') draftSaved(id, shown);
  if (result === 'saved' || result === 'changed') {
    setDraft((current) => checkedDraft(current, shown, result));
  }
}

// A refused field waits for another tab's save of it, which the user can't see.
const waitMessage = (field: FieldTarget['field']) =>
  `Another tab is still saving the ${field}. Yours is tried again once that's done, within a minute.`;

export function useFieldRetry(input: RetryInput) {
  const { id, target, draft, setDraft } = input;
  const check = useDraftCheck(target.ticketKey);
  const read = useFreshTicket(target.ticketKey);
  const checkingRef = useRef(false);
  const { show } = useToast();
  return (by: RetryBy) => {
    if (!draft.failed || draft.conflict || checkingRef.current) return;
    if (by === 'user' && savingWhere(id) === 'elsewhere') {
      show(waitMessage(target.field), { kind: 'error' });
      retryOnceSettled(id);
      return;
    }
    // Saves on their way, also from before the field opened, settle the text, and the tracker
    // may already have one of them without having answered it. The retry waits for them: one
    // of older text landing leaves the field's newer text unsaved.
    if (isSavingAnywhere(id)) {
      retryOnceSettled(id);
      return;
    }
    checkingRef.current = true;
    const shown = draft.value;
    if (!storedDraft(id)) {
      // Its kept text went: another tab saved it, or typed over it and saved or let go of the
      // newer text. No tab removes text it hasn't read, so the field follows the tracker, read
      // first so it shows what it has, rather than putting this text back over the newer one.
      void read()
        .catch(() => undefined)
        .then(() => {
          checkingRef.current = false;
          setDraft((current) => supersededDraft(current, shown));
        });
      return;
    }
    void check(id, draft.landed?.text).then((result) => {
      checkingRef.current = false;
      if (result === 'unreachable' && by === 'user') show(NETWORK_ERROR_MESSAGE, { kind: 'error' });
      settleCheck(input, shown, result, by);
    });
  };
}
