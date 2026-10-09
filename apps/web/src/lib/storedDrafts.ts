import {
  draftIdOf,
  isStoredDraft,
  latestOf,
  type DraftRecord,
  type DraftTarget,
  type Held,
  type StoredDraft,
} from './draftRecord';
import { parseMap } from './storedMap';
import {
  clearRecords,
  dropRecord,
  heldRecords,
  notifyRecords,
  putRecord,
  subscribeRecords,
} from './tabRecords';

export { draftIdOf, type DraftField, type DraftTarget, type StoredDraft } from './draftRecord';
export { DRAFTS_STORAGE_KEY } from './tabRecords';

// The map versions before PT-111 kept (tabRecords.ts).
export const parseDrafts = (raw: string | null) => parseMap(raw, isStoredDraft);

// Every tab's records of a draft. Its text is the one typed last: each tab keeps what it types,
// and one that outdates others removes them.
const recordsOf = (id: string): Held[] =>
  heldRecords().filter(({ record }) => draftIdOf(record) === id);

const latestRecord = (held: readonly Held[]): DraftRecord | undefined => latestOf(held)?.record;

export const subscribeStoredDrafts = subscribeRecords;

export const storedDraft = (id: string): StoredDraft | undefined => latestRecord(recordsOf(id));

export function storedDrafts(): Array<[string, StoredDraft]> {
  const byId = new Map<string, Held[]>();
  for (const held of heldRecords()) {
    const id = draftIdOf(held.record);
    byId.set(id, [...(byId.get(id) ?? []), held]);
  }
  return [...byId].flatMap(([id, held]) => {
    const latest = latestRecord(held);
    return latest ? [[id, latest] as [string, StoredDraft]] : [];
  });
}

export const hasStoredDrafts = (): boolean => heldRecords().length > 0;

// This tab's new record outdates every record of the draft it has read.
function replace(held: readonly Held[], record: DraftRecord): void {
  putRecord(record);
  held.forEach(({ key }) => dropRecord(key));
  notifyRecords();
}

function remove(held: readonly Held[]): void {
  if (held.length === 0) return;
  held.forEach(({ key }) => dropRecord(key));
  notifyRecords();
}

// The first text kept for an id remembers the server value it was typed over. Each new text is
// later than the one before, also within one millisecond.
export function keepDraft(
  id: string,
  draft: DraftTarget & Pick<StoredDraft, 'text' | 'submitted' | 'changed'>,
  base: string,
): void {
  const held = recordsOf(id);
  const latest = latestRecord(held);
  const same = latest?.submitted === draft.submitted && latest?.changed === draft.changed;
  if (same && latest?.text === draft.text) return;
  const at = Math.max(Date.now(), (latest?.at ?? 0) + 1);
  replace(held, { ...draft, base: latest?.base ?? base, at });
}

// A new base keeps the time the text was typed.
export function rebaseDraft(id: string, base: string): void {
  const held = recordsOf(id);
  const latest = latestRecord(held);
  if (!latest || latest.base === base) return;
  replace(held, { ...latest, base });
}

export const forgetDraft = (id: string): void => remove(recordsOf(id));

// The server has `text` now, so the draft is done, or is still ahead of the server.
export function draftSaved(id: string, text: string): void {
  if (storedDraft(id)?.text === text) forgetDraft(id);
  else rebaseDraft(id, text);
}

export function clearStoredDrafts(): void {
  clearRecords();
  notifyRecords();
}

export const forgetTicketDrafts = (ticketKey: string): void =>
  remove(heldRecords().filter(({ record }) => record.ticketKey === ticketKey));
