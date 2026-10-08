import type { Dispatch, SetStateAction } from 'react';
import {
  draftIdOf,
  draftSaved,
  keepDraft,
  storedDraft,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftSave, type DraftSave } from '../drafts/useDraftSave';
import { endSave, markSaved, type FieldDraft } from './fieldDraft';
import { finishSave, saveStep, savesOf, startSave } from './fieldSaves';

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

export type SaveField = (value: string, options?: SaveOptions) => Promise<void>;

interface SaveInput {
  target: FieldTarget;
  server: string;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  onSave: FieldSave;
}

interface Sender {
  send: FieldSave;
  saveDraft: DraftSave;
}

function request({ send, saveDraft }: Sender, draft: StoredDraft, quiet: boolean) {
  const sent = quiet ? saveDraft(draft).then(() => true) : send(draft.text);
  return sent.catch(() => false);
}

export function useFieldSave({ target, server, setDraft, onSave }: SaveInput): SaveField {
  const { ticketKey, field } = target;
  const latest = useLatest({ server, send: onSave, saveDraft: useDraftSave() });
  return async (value, { checked = false, quiet = false } = {}) => {
    const id = draftIdOf({ ticketKey, field });
    const shown = latest.current.server;
    const step = saveStep(savesOf(id), { value, shown, checked });
    if (step === 'skip') return;
    if (step === 'unchanged') {
      draftSaved(id, value);
      setDraft((current) => markSaved(current, value));
      return;
    }
    // Kept until the tracker has it, so leaving or reloading during the request loses nothing.
    if (!storedDraft(id)) keepDraft(id, { ticketKey, field, text: value }, shown);
    const number = startSave(id, value);
    const draft = { ticketKey, field, text: value, base: shown };
    const saved = await request(latest.current, draft, quiet);
    setDraft((current) => endSave(current, value, saved));
    finishSave(id, number, saved);
  };
}
