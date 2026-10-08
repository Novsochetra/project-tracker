import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
import { useLatest } from '../../../lib/useLatest';
import { useLiveDraft } from '../drafts/liveDrafts';
import { useDraftCheck } from '../drafts/useDraftCheck';
import {
  beginSave,
  checkedDraft,
  editDraft,
  endSave,
  keepMine,
  restoreDraft,
  startDraft,
  syncDraft,
  type FieldDraft,
} from './fieldDraft';

// Sends a value to the server and says whether it was saved.
export type FieldSave = (value: string) => Promise<boolean>;

export interface FieldTarget {
  ticketKey: string;
  field: 'title' | 'description' | 'assignee';
}

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

type SetDraft = Dispatch<SetStateAction<FieldDraft>>;

const openDraft = (server: string, id: string): FieldDraft => {
  const stored = storedDraft(id);
  return stored ? restoreDraft(stored.text) : startDraft(server);
};

interface SaveInput {
  target: FieldTarget;
  server: string;
  setDraft: SetDraft;
  onSave: FieldSave;
}

function useFieldSave({ target: { ticketKey, field }, server, setDraft, onSave }: SaveInput) {
  const latest = useLatest({ server, onSave });
  return useCallback(
    (value: string, checked = false) => {
      const id = draftIdOf({ ticketKey, field });
      // Text the server already shows needs no request. A failed save can leave its text in the
      // cache (rollbacks landing out of order), so a retry that checked the tracker always sends.
      const unchanged = !checked && value === latest.current.server;
      const request = unchanged ? Promise.resolve(true) : latest.current.onSave(value);
      // The store hears the outcome even after the screen has closed. A re-save of text the
      // server already had (leaving the field) has no kept draft yet, so a failure keeps one.
      const settle = (saved: boolean) => {
        if (saved) draftSaved(id, value);
        else if (!storedDraft(id)) keepDraft(id, { ticketKey, field, text: value }, value);
        setDraft((current) => endSave(current, value, saved));
      };
      setDraft(beginSave);
      void request.then(settle, () => settle(false));
    },
    [ticketKey, field, latest, setDraft],
  );
}

interface RetryInput {
  id: string;
  ticketKey: string;
  draft: FieldDraft;
  setDraft: SetDraft;
  save: (value: string, checked: boolean) => void;
}

type Retry = (whenUnreachable?: () => void) => void;

function useFieldRetry({ id, ticketKey, draft, setDraft, save }: RetryInput): Retry {
  const check = useDraftCheck(ticketKey);
  const checkingRef = useRef(false);
  return (whenUnreachable) => {
    if (!draft.failed || draft.conflict || draft.saving > 0 || checkingRef.current) return;
    checkingRef.current = true;
    const shown = draft.value;
    void check(id).then((result) => {
      checkingRef.current = false;
      if (result === 'unreachable') whenUnreachable?.();
      // Saves the newest typed text; none is kept when the user dropped it while this ran.
      const kept = storedDraft(id);
      if (result === 'unchanged' && kept) save(kept.text, true);
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
  // Retries the app starts on its own stay quiet; the offline banner already says why.
  useLiveDraft(id, () => retry());
  const { show } = useToast();

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
    retry: () => retry(() => show(NETWORK_ERROR_MESSAGE)),
    saveMine: () => {
      rebaseDraft(id, server);
      setDraft(keepMine);
      save(synced.value, true);
    },
    discardMine: () => {
      forgetDraft(id);
      setDraft(startDraft(server));
    },
  };
}
