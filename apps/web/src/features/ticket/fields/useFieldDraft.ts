import { useState } from 'react';
import { editDraft, startDraft, syncDraft } from './fieldDraft';

export interface FieldDraftState {
  value: string;
  edited: boolean;
  change: (value: string) => void;
  focus: () => void;
  blur: () => void;
  reset: () => void;
}

export function useFieldDraft(server: string): FieldDraftState {
  const [draft, setDraft] = useState(() => startDraft(server));
  const [focused, setFocused] = useState(false);
  const synced = syncDraft(draft, server, focused);
  if (synced !== draft) setDraft(synced);
  return {
    value: synced.value,
    edited: synced.edited,
    change: (value) => setDraft((current) => editDraft(current, value)),
    focus: () => setFocused(true),
    blur: () => setFocused(false),
    reset: () => setDraft(startDraft(server)),
  };
}
