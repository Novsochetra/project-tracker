import { useState, useSyncExternalStore } from 'react';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  rebaseDraft,
  storedDraft,
  subscribeStoredDrafts,
} from '../../../lib/storedDrafts';
import { useLiveDraft } from '../drafts/liveDrafts';
import {
  editDraft,
  keepMine,
  restoreDraft,
  startDraft,
  syncDraft,
  type FieldDraft,
} from './fieldDraft';
import { carries, isSavingElsewhere, savesOf, savingWhere, subscribeSaves } from './fieldSaves';
import { retryOnceSettled, useFieldRetry } from './useFieldRetry';
import { useFieldSave, type FieldTarget } from './useFieldSave';

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

// Typed text is kept in the drafts store until the server has it, so leaving the ticket or
// reloading doesn't lose it.
export function useFieldDraft(server: string, target: FieldTarget): FieldDraftState {
  const id = draftIdOf(target);
  const [draft, setDraft] = useState(() => openDraft(server, id));
  const [focused, setFocused] = useState(false);
  const where = useSyncExternalStore(subscribeSaves, () => savingWhere(id));
  const kept = useSyncExternalStore(subscribeStoredDrafts, () => storedDraft(id)?.text);
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
  });
  const retry = useFieldRetry({ id, target, draft: synced, setDraft, save });
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
    save: (value) => void save(value),
    retry: () => retry('user'),
    saveMine: () => {
      rebaseDraft(id, server);
      setDraft(keepMine);
      void save(synced.value, { checked: true });
    },
    discardMine: () => {
      forgetDraft(id);
      setDraft(startDraft(server));
    },
  };
}
