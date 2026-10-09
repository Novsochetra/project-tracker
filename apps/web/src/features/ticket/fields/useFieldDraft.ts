import { useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
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
import { retryLiveDraft, useLiveDraft } from '../drafts/liveDrafts';
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
import {
  carries,
  isSavingAnywhere,
  isSavingElsewhere,
  savesOf,
  savingWhere,
  subscribeSaves,
  whenSettled,
} from './fieldSaves';
import { useFieldSave, type FieldTarget, type SaveField } from './useFieldSave';
import { useKeptText } from './useKeptText';

export interface FieldDraftState {
  value: string;
  edited: boolean;
  failed: boolean;
  // Someone else changed the field meanwhile; only saveMine or discardMine settles it.
  conflict: boolean;
  change: (value: string) => void;
  focus: () => void;
  blur: () => void;
  save: (value: string) => void;
  retry: () => void;
  saveMine: () => void;
  discardMine: () => void;
}

const openDraft = (server: string, id: string): FieldDraft => {
  const stored = storedDraft(id);
  if (!stored) return startDraft(server);
  return restoreDraft(stored.text, carries(savesOf(id), stored.text) || isSavingElsewhere(id));
};

interface RetryInput {
  id: string;
  target: FieldTarget;
  server: string;
  draft: FieldDraft;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  save: SaveField;
  // The tracker has the text: its kept copy going is right.
  settled: (value: string) => void;
}

// While the field is on screen. A task later, because the retry reads the field's state, which
// shows a refused save once it renders.
const retryOnceSettled = (id: string) =>
  whenSettled(id, () => setTimeout(() => retryLiveDraft(id)));

// The user's Retry says when the tracker can't be reached. Retries the app starts on its own
// stay quiet, also when their save fails: the field's note already says it isn't saved.
type RetryBy = 'user' | 'app';

function useFieldRetry({ id, target, server, draft, setDraft, save, settled }: RetryInput) {
  const check = useDraftCheck(target.ticketKey);
  const checkingRef = useRef(false);
  const { show } = useToast();
  return (by: RetryBy) => {
    // Saves on their way, also from before the field opened, settle the text, and the tracker
    // may already have one of them without having answered it.
    if (!draft.failed || draft.conflict || isSavingAnywhere(id) || checkingRef.current) return;
    checkingRef.current = true;
    const shown = draft.value;
    // A refused edit outlives its kept text, which another tab can drop from a copy of the store
    // that hadn't heard of it yet: it is kept again for the check.
    if (!storedDraft(id)) keepDraft(id, { ...target, text: shown }, draft.landed?.text ?? server);
    void check(id, draft.landed?.text).then((result) => {
      checkingRef.current = false;
      if (result === 'unreachable' && by === 'user') show(NETWORK_ERROR_MESSAGE, { kind: 'error' });
      // Saves the newest typed text; none is kept when the user dropped it while this ran.
      const kept = storedDraft(id);
      if (result === 'unchanged' && kept) {
        void save(kept.text, { checked: true, quiet: by === 'app' });
      } else if (result === 'gone') forgetDraft(id);
      else if (result === 'saved') {
        settled(shown);
        draftSaved(id, shown);
      }
      if (result === 'saved' || result === 'changed') {
        setDraft((current) => checkedDraft(current, shown, result));
      }
    });
  };
}

// Typed text is kept in the drafts store until the server has it, so leaving the ticket or
// reloading doesn't lose it.
export function useFieldDraft(server: string, target: FieldTarget): FieldDraftState {
  const id = draftIdOf(target);
  const [draft, setDraft] = useState(() => openDraft(server, id));
  const [focused, setFocused] = useState(false);
  const where = useSyncExternalStore(subscribeSaves, () => savingWhere(id));
  const own = useKeptText(id, target, draft, draft.landed?.text ?? server);
  const { kept } = own;
  const synced = syncDraft(draft, server, {
    focused,
    saving: where === 'here',
    sentElsewhere: where === 'elsewhere',
    kept,
  });
  if (synced !== draft) setDraft(synced);
  const save = useFieldSave({
    target,
    server,
    landed: synced.landed?.text,
    setDraft,
    // Checked like a retry: the check tells text typed over the newer one from text someone else
    // changed meanwhile.
    onStale: () => retryOnceSettled(id),
    onLanded: own.settled,
  });
  const retry = useFieldRetry({
    id,
    target,
    server,
    draft: synced,
    setDraft,
    save,
    settled: own.settled,
  });
  useLiveDraft(id, () => retry('app'));

  return {
    value: synced.value,
    edited: synced.edited,
    failed: synced.failed,
    conflict: synced.conflict,
    change: (value) => {
      keepDraft(id, { ...target, text: value }, synced.value);
      own.typed(value);
      setDraft((current) => editDraft(current, value));
    },
    focus: () => setFocused(true),
    blur: () => setFocused(false),
    save: (value) => void save(value),
    retry: () => retry('user'),
    saveMine: () => {
      rebaseDraft(id, server);
      setDraft(keepMine);
      void save(synced.value, { checked: true });
    },
    discardMine: () => {
      own.settled(synced.value);
      forgetDraft(id);
      setDraft(startDraft(server));
    },
  };
}
