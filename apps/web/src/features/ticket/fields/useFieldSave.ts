import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { draftIdOf, draftSaved, keepDraft, storedDraft } from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftSave } from '../drafts/useDraftSave';
import { beginSave, endSave, type FieldDraft } from './fieldDraft';

// Sends a value to the server and says whether it was saved.
export type FieldSave = (value: string) => Promise<boolean>;

export interface FieldTarget {
  ticketKey: string;
  field: 'title' | 'description' | 'assignee';
}

export interface SaveOptions {
  // A retry that checked the tracker first: it always sends, whatever the cache shows.
  checked?: boolean;
  // Started by the app, not the user: no toast when it fails, the field's note says so.
  quiet?: boolean;
}

export type SaveField = (value: string, options?: SaveOptions) => void;

interface SaveInput {
  target: FieldTarget;
  server: string;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  onSave: FieldSave;
}

// Counts the saves of each text that are on their way.
function track(sending: Map<string, number>, value: string, request: Promise<boolean>) {
  sending.set(value, (sending.get(value) ?? 0) + 1);
  return request.finally(() => {
    const left = (sending.get(value) ?? 1) - 1;
    if (left > 0) sending.set(value, left);
    else sending.delete(value);
  });
}

export function useFieldSave({ target, server, setDraft, onSave }: SaveInput): SaveField {
  const { ticketKey, field } = target;
  const latest = useLatest({ server, onSave, saveDraft: useDraftSave() });
  const sendingRef = useRef(new Map<string, number>());
  return useCallback(
    (value, { checked = false, quiet = false } = {}) => {
      const id = draftIdOf({ ticketKey, field });
      // Leaving the field saves what an autosave may still be sending. The cache then shows that
      // save's optimistic copy, not the tracker's, so that save is left to settle the field.
      if (!checked && sendingRef.current.has(value)) return;
      const { server: shown, onSave: send, saveDraft } = latest.current;
      // A failed save can leave its text in the cache (rollbacks landing out of order), so a
      // checked retry sends even when the cache shows it.
      const unchanged = !checked && value === shown;
      // Kept until the tracker has it, so leaving or reloading during the request loses nothing.
      if (!unchanged && !storedDraft(id)) keepDraft(id, { ticketKey, field, text: value }, shown);
      const sendQuietly = () =>
        saveDraft({ ticketKey, field, text: value, base: shown }).then(
          () => true,
          () => false,
        );
      const request = unchanged
        ? Promise.resolve(true)
        : track(sendingRef.current, value, quiet ? sendQuietly() : send(value));
      const settle = (saved: boolean) => {
        if (saved) draftSaved(id, value);
        setDraft((current) => endSave(current, value, saved));
      };
      setDraft(beginSave);
      void request.then(settle, () => settle(false));
    },
    [ticketKey, field, latest, setDraft],
  );
}
