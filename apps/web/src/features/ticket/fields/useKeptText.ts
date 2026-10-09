import { useEffect, useSyncExternalStore } from 'react';
import { keepDraft, storedDraft, subscribeStoredDrafts } from '../../../lib/storedDrafts';
import type { FieldDraft } from './fieldDraft';
import { ownTextOf, typedHere } from './fieldSaves';
import type { FieldTarget } from './useFieldSave';

export interface KeptText {
  // What the drafts store keeps for the field, as the field should take it.
  kept: string | undefined;
  typed: (value: string) => void;
  // The tracker has `value`, so the store letting it go is right.
  settled: (value: string) => void;
}

// Another tab can write the drafts store back from a copy that hadn't heard of this field's newest
// typing yet, putting older text back. While the field still shows the text it typed last and the
// tracker doesn't have it, it keeps that text and puts it back in the store; text another tab
// typed later is still taken. Text that goes from the store is left to the field's rules: saved
// elsewhere, unless its save was refused (FieldDraft.refused).
export function useKeptText(id: string, target: FieldTarget, draft: FieldDraft, base: string) {
  const text = useSyncExternalStore(subscribeStoredDrafts, () => storedDraft(id)?.text);
  const at = useSyncExternalStore(subscribeStoredDrafts, () => storedDraft(id)?.at);
  const own = ownTextOf(id);
  const lost =
    own !== undefined &&
    draft.edited &&
    draft.value === own.text &&
    text !== undefined &&
    text !== own.text &&
    (at === undefined || at < own.at);
  const typed = (value: string) =>
    typedHere(id, { text: value, at: storedDraft(id)?.at ?? Date.now() });
  useEffect(() => {
    if (!lost) return;
    keepDraft(id, { ...target, text: draft.value }, base);
    typed(draft.value);
  });
  return {
    kept: lost ? own.text : text,
    typed,
    settled: (value) => {
      if (ownTextOf(id)?.text === value) typedHere(id, null);
    },
  } satisfies KeptText;
}
