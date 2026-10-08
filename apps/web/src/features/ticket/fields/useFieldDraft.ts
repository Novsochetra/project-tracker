import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { beginSave, editDraft, endSave, startDraft, syncDraft } from './fieldDraft';
import { useDraftMark } from './useDraftMark';
import { useRetryWhenOnline } from './useRetryWhenOnline';

/** Saves a value and says whether it was saved; nothing means the server already has it. */
export type FieldSave = (value: string) => Promise<boolean> | undefined;

export interface FieldDraftState {
  value: string;
  edited: boolean;
  /** Saving failed; the field keeps the text and tries again when the app is back online. */
  failed: boolean;
  change: (value: string) => void;
  focus: () => void;
  blur: () => void;
  save: (value: string) => void;
  retry: () => void;
}

/**
 * Local text for a field the server also changes. Typed text counts as a draft (drafts contract)
 * until the server has it, and is kept through failed saves.
 */
export function useFieldDraft(server: string, draftId: string, onSave: FieldSave): FieldDraftState {
  const [draft, setDraft] = useState(() => startDraft(server));
  const [focused, setFocused] = useState(false);
  const onSaveRef = useRef(onSave);
  useLayoutEffect(() => {
    onSaveRef.current = onSave;
  });
  const synced = syncDraft(draft, server, focused);
  if (synced !== draft) setDraft(synced);

  const save = useCallback((value: string) => {
    const request = onSaveRef.current(value) ?? Promise.resolve(true);
    const settle = (saved: boolean) => setDraft((current) => endSave(current, value, saved));
    setDraft(beginSave);
    void request.then(settle, () => settle(false));
  }, []);
  const retry = () => save(synced.value);
  useRetryWhenOnline(synced.failed, retry);
  useDraftMark(draftId, synced.edited);

  return {
    value: synced.value,
    edited: synced.edited,
    failed: synced.failed,
    change: (value) => setDraft((current) => editDraft(current, value)),
    focus: () => setFocused(true),
    blur: () => setFocused(false),
    save,
    retry,
  };
}
