import { isDraftRecord, isStoredDraft, type DraftRecord, type Held } from './draftRecord';
import { draftsNotKept } from './draftStorage';
import { storedMap } from './storedMap';

// Versions before PT-111 kept every tab's drafts in this one map, which every tab wrote whole. It
// is read as one more tab's records: text kept before the update, and text typed in tabs still on
// the older version until they reload.
export const DRAFTS_STORAGE_KEY = 'tracker.drafts';
const SHARED = `${DRAFTS_STORAGE_KEY}#`;
const shared = storedMap(DRAFTS_STORAGE_KEY, isStoredDraft);

// This tab's records go under keys only it writes: `tracker.drafts:<tab>:<n>`.
const PREFIX = `${DRAFTS_STORAGE_KEY}:`;
const TAB = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
let written = 0;

// Records storage refused (full, or turned off), kept in the page's memory so they still outlive
// the screen.
const unstored = new Map<string, DraftRecord>();

function recordKeys(): string[] {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    return keys.filter((key): key is string => key?.startsWith(PREFIX) === true);
  } catch {
    return [];
  }
}

function parse(raw: string): DraftRecord | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return isDraftRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// Read often (each render of a field), so each stored text is parsed once while it is stored.
let parsed = new Map<string, DraftRecord | undefined>();

function storedRecords(): Held[] {
  const seen = new Map<string, DraftRecord | undefined>();
  const held = recordKeys().flatMap((key) => {
    const raw = localStorage.getItem(key) ?? '';
    const record = parsed.has(raw) ? parsed.get(raw) : parse(raw);
    seen.set(raw, record);
    return record ? [{ key, record }] : [];
  });
  parsed = seen;
  return held;
}

// The shared map's entries, as records older than any this version puts.
const sharedRecords = (): Held[] =>
  Object.entries(shared.read()).map(([id, draft]) => ({
    key: `${SHARED}${id}`,
    record: { ...draft, at: draft.at ?? 0 },
  }));

export const heldRecords = (): Held[] => [
  ...storedRecords(),
  ...[...unstored].map(([key, record]) => ({ key, record })),
  ...sharedRecords(),
];

export function putRecord(record: DraftRecord): void {
  const key = `${PREFIX}${TAB}:${(written++).toString(36)}`;
  try {
    localStorage.setItem(key, JSON.stringify(record));
    return;
  } catch {
    // Kept in memory instead: see `unstored`.
  }
  const allKept = unstored.size === 0;
  unstored.set(key, record);
  if (allKept) draftsNotKept();
}

// Any tab may remove a record it has read: it never changes, so a newer one, put meanwhile by
// another tab, is a record of its own and stays.
export function dropRecord(key: string): void {
  if (unstored.delete(key)) return;
  if (key.startsWith(SHARED)) {
    const { [key.slice(SHARED.length)]: dropped, ...rest } = shared.read();
    if (dropped) shared.write(rest);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Without storage there is nothing stored to remove.
  }
}

// Tests start with no records, also none that full storage left in the page's memory.
export function clearRecords(): void {
  recordKeys().forEach(dropRecord);
  shared.write({});
  unstored.clear();
}

const listeners = new Set<() => void>();

export const notifyRecords = (): void => listeners.forEach((listener) => listener());

// Another tab's writes arrive as storage events (a null key: storage was cleared). A tab the
// browser suspended may have missed some, so it reads again once it is shown.
function onOutsideChange(event: Event): void {
  if (event instanceof StorageEvent && event.key !== null) {
    if (event.key !== DRAFTS_STORAGE_KEY && !event.key.startsWith(PREFIX)) return;
  }
  notifyRecords();
}

export function subscribeRecords(listener: () => void): () => void {
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
