import { draftStorage } from './draftStorage';
import { parseMap, type StoredMap } from './storedMap';

export type DraftField = 'title' | 'description' | 'assignee' | 'comment' | 'comment-edit';

export interface DraftTarget {
  ticketKey: string;
  field: DraftField;
  activityId?: string;
}

export interface StoredDraft extends DraftTarget {
  // The server value the text was typed over: a different one later means someone else
  // changed it meanwhile.
  base: string;
  text: string;
  // Save was pressed for this text. A comment edit is only ever sent for the user after that.
  submitted?: boolean;
  // When the text was typed. Another tab that writes the store back from a copy that hadn't heard
  // of newer text keeps the older time, so the tab that typed the newer text can tell.
  at?: number;
}

type Drafts = StoredMap<StoredDraft>;

export const DRAFTS_STORAGE_KEY = 'tracker.drafts';

const FIELDS: ReadonlySet<unknown> = new Set<DraftField>([
  'title',
  'description',
  'assignee',
  'comment',
  'comment-edit',
]);

export const draftIdOf = ({ ticketKey, field, activityId }: DraftTarget): string =>
  field === 'comment-edit' ? `comment-edit:${activityId ?? ''}` : `${field}:${ticketKey}`;

const isText = (value: unknown): value is string => typeof value === 'string';

function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    isText(draft.ticketKey) &&
    FIELDS.has(draft.field) &&
    isText(draft.base) &&
    isText(draft.text) &&
    (draft.activityId === undefined || isText(draft.activityId)) &&
    (draft.submitted === undefined || typeof draft.submitted === 'boolean') &&
    (draft.at === undefined || typeof draft.at === 'number')
  );
}

export const parseDrafts = (raw: string | null): Drafts => parseMap(raw, isStoredDraft);

const storage = draftStorage(DRAFTS_STORAGE_KEY, isStoredDraft);
const { load } = storage;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function store(drafts: Drafts): void {
  storage.store(drafts);
  notify();
}

// Another tab's writes arrive as storage events (a null key: storage was cleared). A tab the
// browser suspended may have missed some, so it reads again once it is shown.
function onOutsideChange(event: Event): void {
  if (event instanceof StorageEvent && event.key !== null && event.key !== DRAFTS_STORAGE_KEY) {
    return;
  }
  notify();
}

export function subscribeStoredDrafts(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('storage', onOutsideChange);
    document.addEventListener('visibilitychange', onOutsideChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('storage', onOutsideChange);
    document.removeEventListener('visibilitychange', onOutsideChange);
  };
}

export const storedDraft = (id: string): StoredDraft | undefined => load()[id];

export const storedDrafts = (): Array<[string, StoredDraft]> => Object.entries(load());

export const hasStoredDrafts = (): boolean => Object.keys(load()).length > 0;

// The first text kept for an id remembers the server value it was typed over.
export function keepDraft(
  id: string,
  draft: DraftTarget & Pick<StoredDraft, 'text' | 'submitted'>,
  base: string,
): void {
  const drafts = load();
  const current = drafts[id];
  if (current?.text === draft.text && current.submitted === draft.submitted) return;
  const at = Math.max(Date.now(), (current?.at ?? 0) + 1);
  store({ ...drafts, [id]: { ...draft, base: current?.base ?? base, at } });
}

export function rebaseDraft(id: string, base: string): void {
  const drafts = load();
  const current = drafts[id];
  if (current && current.base !== base) store({ ...drafts, [id]: { ...current, base } });
}

export function forgetDraft(id: string): void {
  const { [id]: forgotten, ...rest } = load();
  if (forgotten) store(rest);
}

// The server has `text` now, so the draft is done, or is still ahead of the server.
export function draftSaved(id: string, text: string): void {
  if (storedDraft(id)?.text === text) forgetDraft(id);
  else rebaseDraft(id, text);
}

// Tests start with no drafts, also none that full storage left in the page's memory.
export const clearStoredDrafts = (): void => store({});

export function forgetTicketDrafts(ticketKey: string): void {
  const drafts = storedDrafts();
  const kept = drafts.filter(([, draft]) => draft.ticketKey !== ticketKey);
  if (kept.length < drafts.length) store(Object.fromEntries(kept));
}
