export type DraftField = 'title' | 'description' | 'assignee' | 'comment' | 'comment-edit';

export interface DraftTarget {
  ticketKey: string;
  field: DraftField;
  // The comment being edited, for comment-edit drafts.
  activityId?: string;
}

export interface StoredDraft extends DraftTarget {
  // The server value the text was typed over: a different one later means someone else
  // changed it meanwhile.
  base: string;
  text: string;
}

type Drafts = Readonly<Record<string, StoredDraft>>;

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
    (draft.activityId === undefined || isText(draft.activityId))
  );
}

export function parseDrafts(raw: string | null): Drafts {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, draft]) => isStoredDraft(draft)));
  } catch {
    return {};
  }
}

let cached: { raw: string | null; drafts: Drafts } = { raw: null, drafts: {} };
// Takes over once storage fails (private mode, full), so drafts still outlive the screen.
let memory: Drafts | null = null;

function load(): Drafts {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (raw !== cached.raw) cached = { raw, drafts: parseDrafts(raw) };
    return cached.drafts;
  } catch {
    memory = {};
    return memory;
  }
}

function persist(drafts: Drafts): boolean {
  try {
    if (Object.keys(drafts).length === 0) window.localStorage.removeItem(DRAFTS_STORAGE_KEY);
    else window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

function store(drafts: Drafts): void {
  if (!memory && persist(drafts)) return;
  memory = drafts;
}

export const storedDraft = (id: string): StoredDraft | undefined => load()[id];

export const storedDrafts = (): Array<[string, StoredDraft]> => Object.entries(load());

export const hasStoredDrafts = (): boolean => Object.keys(load()).length > 0;

// The first text kept for an id remembers the server value it was typed over.
export function keepDraft(id: string, draft: DraftTarget & { text: string }, base: string): void {
  const drafts = load();
  const current = drafts[id];
  if (current?.text === draft.text) return;
  store({ ...drafts, [id]: { ...draft, base: current?.base ?? base } });
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

export function forgetTicketDrafts(ticketKey: string): void {
  const drafts = storedDrafts();
  const kept = drafts.filter(([, draft]) => draft.ticketKey !== ticketKey);
  if (kept.length < drafts.length) store(Object.fromEntries(kept));
}
