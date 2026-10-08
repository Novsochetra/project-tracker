import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { NETWORK_ERROR_MESSAGE } from '../../../api';
import { useToast } from '../../../components';
import {
  draftIdOf,
  draftSaved,
  forgetDraft,
  keepDraft,
  rebaseDraft,
  storedDraft,
} from '../../../lib/storedDrafts';
import { useLiveDraft } from '../drafts/liveDrafts';
import { useDraftCheck } from '../drafts/useDraftCheck';
import {
  checkedDraft,
  editDraft,
  keepMine,
  restoreDraft,
  startDraft,
  syncDraft,
  type FieldDraft,
} from './fieldDraft';
import { useFieldSave, type FieldSave, type FieldTarget, type SaveField } from './useFieldSave';

export interface FieldDraftState {
  value: string;
  edited: boolean;
  // Not saved yet: the field keeps the text and tries again when the tracker can be reached.
  failed: boolean;
  // Someone else changed the field meanwhile; only saveMine or discardMine settles it.
  conflict: boolean;
  change: (value: string) => void;
  focus: () => void;
  blur: () => void;
  save: (value: string) => void;
  // Saves the kept text if the tracker still has the value it was typed over, and says so when
  // the tracker can't be reached.
  retry: () => void;
  saveMine: () => void;
  discardMine: () => void;
}

const openDraft = (server: string, id: string): FieldDraft => {
  const stored = storedDraft(id);
  return stored ? restoreDraft(stored.text) : startDraft(server);
};

interface RetryInput {
  id: string;
  ticketKey: string;
  draft: FieldDraft;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  save: SaveField;
}

// The user's Retry says when the tracker can't be reached. Retries the app starts on its own
// stay quiet, also when their save fails: the field's note already says it isn't saved.
type RetryBy = 'user' | 'app';

function useFieldRetry({ id, ticketKey, draft, setDraft, save }: RetryInput) {
  const check = useDraftCheck(ticketKey);
  const checkingRef = useRef(false);
  const { show } = useToast();
  return (by: RetryBy) => {
    if (!draft.failed || draft.conflict || draft.saving > 0 || checkingRef.current) return;
    checkingRef.current = true;
    const shown = draft.value;
    void check(id).then((result) => {
      checkingRef.current = false;
      if (result === 'unreachable' && by === 'user') show(NETWORK_ERROR_MESSAGE);
      // Saves the newest typed text; none is kept when the user dropped it while this ran.
      const kept = storedDraft(id);
      if (result === 'unchanged' && kept) save(kept.text, { checked: true, quiet: by === 'app' });
      else if (result === 'gone') forgetDraft(id);
      else if (result === 'saved') draftSaved(id, shown);
      if (result === 'saved' || result === 'changed') {
        setDraft((current) => checkedDraft(current, shown, result));
      }
    });
  };
}

// Local text for a field the server also changes. Typed text is kept in the drafts store until
// the server has it, so leaving the ticket or reloading doesn't lose it.
export function useFieldDraft(
  server: string,
  target: FieldTarget,
  onSave: FieldSave,
): FieldDraftState {
  const id = draftIdOf(target);
  const [draft, setDraft] = useState(() => openDraft(server, id));
  const [focused, setFocused] = useState(false);
  const synced = syncDraft(draft, server, focused);
  if (synced !== draft) setDraft(synced);
  const save = useFieldSave({ target, server, setDraft, onSave });
  const retry = useFieldRetry({ id, ticketKey: target.ticketKey, draft: synced, setDraft, save });
  useLiveDraft(id, () => retry('app'));

  return {
    value: synced.value,
    edited: synced.edited,
    failed: synced.failed,
    conflict: synced.conflict,
    change: (value) => {
      keepDraft(id, { ...target, text: value }, synced.value);
      setDraft((current) => editDraft(current, value));
    },
    focus: () => setFocused(true),
    blur: () => setFocused(false),
    save: (value) => save(value),
    retry: () => retry('user'),
    saveMine: () => {
      rebaseDraft(id, server);
      setDraft(keepMine);
      save(synced.value, { checked: true });
    },
    discardMine: () => {
      forgetDraft(id);
      setDraft(startDraft(server));
    },
  };
}
