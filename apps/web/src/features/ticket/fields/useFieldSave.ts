import type { Dispatch, SetStateAction } from 'react';
import { errorMessage, isStaleEdit } from '../../../api';
import { useToast, type ToastApi } from '../../../components';
import {
  draftIdOf,
  draftSaved,
  keepDraft,
  storedDraft,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftSave, type DraftSave } from '../drafts/useDraftSave';
import { endSave, markSaved, refuseSave, type FieldDraft } from './fieldDraft';
import {
  claimText,
  finishSave,
  isSavingElsewhere,
  ownTextOf,
  saveStep,
  savesOf,
  startSave,
  typedOver,
} from './fieldSaves';

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
  // This tab's copy of the field, and text the tracker has or may have that the copy may not show
  // (FieldDraft.landed).
  server: string;
  landed: string | undefined;
  setDraft: Dispatch<SetStateAction<FieldDraft>>;
  // The tracker refused a save because the field has newer text than it was typed over.
  onStale: () => void;
  // The tracker has `value`, so the store letting it go is right.
  onLanded: (value: string) => void;
}

type SaveResult = 'saved' | 'failed' | 'stale';

interface Sender {
  saveDraft: DraftSave;
  show: ToastApi['show'];
}

// A refused save gets no toast: the field's note says it isn't saved, and a check follows.
async function request(
  sender: Sender,
  draft: Parameters<DraftSave>[0],
  quiet: boolean,
): Promise<SaveResult> {
  try {
    await sender.saveDraft(draft);
    return 'saved';
  } catch (error) {
    if (isStaleEdit(error)) return 'stale';
    if (!quiet) sender.show(errorMessage(error), { kind: 'error' });
    return 'failed';
  }
}

interface Answered {
  id: string;
  number: number;
  draft: StoredDraft;
  result: SaveResult;
}

function afterAnswer({ id, number, draft, result }: Answered, input: SaveInput): void {
  const { text, ticketKey, field, base } = draft;
  // Another tab can drop the kept text from a copy of the store that hadn't heard of it while
  // the save was on its way, which reads as saved elsewhere. A failed save keeps it again,
  // unless newer text was typed since, here or in another tab.
  if (result === 'failed' && !storedDraft(id) && ownTextOf(id)?.text === text) {
    keepDraft(id, { ticketKey, field, text }, base);
  }
  input.setDraft((current) =>
    result === 'stale' ? refuseSave(current, text) : endSave(current, text, result === 'saved'),
  );
  if (result === 'saved') input.onLanded(text);
  finishSave(id, number, result === 'saved');
  if (result === 'stale') input.onStale();
}

export function useFieldSave(input: SaveInput): SaveField {
  const { target, setDraft } = input;
  const { ticketKey, field } = target;
  const { show } = useToast();
  const latest = useLatest({ ...input, saveDraft: useDraftSave(), show });
  return async (value, { checked = false, quiet = false } = {}) => {
    const id = draftIdOf({ ticketKey, field });
    const { landed: typedOverLanded } = latest.current;
    const shown = typedOverLanded ?? latest.current.server;
    const sentElsewhere = isSavingElsewhere(id);
    const base = storedDraft(id)?.base;
    const step = saveStep(savesOf(id), { value, shown, checked, sentElsewhere, base });
    if (step === 'skip') return;
    if (step === 'unchanged') {
      latest.current.onLanded(value);
      draftSaved(id, value);
      setDraft((current) => markSaved(current, value));
      return;
    }
    // Kept until the tracker has it, so leaving or reloading during the request loses nothing.
    if (!storedDraft(id)) keepDraft(id, { ticketKey, field, text: value }, shown);
    // A checked save names what the check found; another, the newest text it may be typed over.
    const expected = typedOver(
      savesOf(id),
      checked ? (base ?? shown) : (typedOverLanded ?? base ?? shown),
    );
    const number = startSave(id, value);
    claimText(id, value);
    const draft = { ticketKey, field, text: value, base: expected };
    const result = await request(latest.current, draft, quiet);
    afterAnswer({ id, number, draft, result }, latest.current);
  };
}
