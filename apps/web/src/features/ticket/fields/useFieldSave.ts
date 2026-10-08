import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  draftIdOf,
  draftSaved,
  keepDraft,
  rebaseDraft,
  storedDraft,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftSave, type DraftSave } from '../drafts/useDraftSave';
import { beginSave, endSave, type FieldDraft } from './fieldDraft';
import { NO_SAVES, saveStep, sendSave, settleSave, type SaveOutcome } from './fieldSaves';

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

// Resolves once the save has settled, or at once when nothing had to be sent.
export type SaveField = (value: string, options?: SaveOptions) => Promise<void>;

export interface FieldSaver {
  save: SaveField;
  // A save of the field is on its way, known as soon as it is sent.
  sending: () => boolean;
}

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

function keepOutcome(id: string, value: string, outcome: SaveOutcome): void {
  if (outcome === 'done') draftSaved(id, value);
  else if (outcome === 'rebase') rebaseDraft(id, value);
}

export function useFieldSave({ target, server, setDraft, onSave }: SaveInput): FieldSaver {
  const { ticketKey, field } = target;
  const latest = useLatest({ server, send: onSave, saveDraft: useDraftSave() });
  const savesRef = useRef(NO_SAVES);
  const save = useCallback<SaveField>(
    async (value, { checked = false, quiet = false } = {}) => {
      const id = draftIdOf({ ticketKey, field });
      const shown = latest.current.server;
      const step = saveStep(savesRef.current, { value, shown, checked });
      if (step === 'skip') return;
      if (step === 'unchanged') {
        draftSaved(id, value);
        setDraft((current) => endSave(beginSave(current), value, true));
        return;
      }
      // Kept until the tracker has it, so leaving or reloading during the request loses nothing.
      if (!storedDraft(id)) keepDraft(id, { ticketKey, field, text: value }, shown);
      savesRef.current = sendSave(savesRef.current, value);
      const number = savesRef.current.latest;
      setDraft(beginSave);
      const draft = { ticketKey, field, text: value, base: shown };
      const saved = await request(latest.current, draft, quiet);
      const settled = settleSave(savesRef.current, number, saved);
      savesRef.current = settled.saves;
      keepOutcome(id, value, settled.outcome);
      setDraft((current) => endSave(current, value, saved));
    },
    [ticketKey, field, latest, setDraft],
  );
  return { save, sending: () => savesRef.current.onTheirWay.size > 0 };
}
