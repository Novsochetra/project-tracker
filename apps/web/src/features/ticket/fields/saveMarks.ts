// The saves of a draft on their way live in the memory of the tab that sent them. Other tabs
// can't see that, and their app-wide sync would take the tracker having the first of them for a
// change, so each tab also marks the drafts it is sending in storage, until a time after which a
// tab that closed while sending stops counting.
export const SAVE_MARKS_STORAGE_KEY = 'tracker.draftSaves';
const MARK_MS = 60_000;

const PAGE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

interface Mark {
  draft: string;
  page: string;
  until: number;
}

const isMark = (value: unknown): value is Mark =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Mark).draft === 'string' &&
  typeof (value as Mark).page === 'string' &&
  typeof (value as Mark).until === 'number';

// One key per tab and draft, which only that tab writes. A tab writing every tab's marks back as
// one value, from a copy of storage that hadn't heard of another tab removing its mark yet, put
// that mark back, and the other tabs then waited a minute for a save that had landed.
const keyOf = (id: string): string => `${SAVE_MARKS_STORAGE_KEY}:${PAGE}:${id}`;

// The key earlier versions kept every mark under counts too, so what it holds is cleared.
const isMarkKey = (key: string | null): key is string =>
  key !== null && (key === SAVE_MARKS_STORAGE_KEY || key.startsWith(`${SAVE_MARKS_STORAGE_KEY}:`));

function readMark(key: string): Mark | undefined {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return isMark(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function markKeys(): string[] {
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    );
    return keys.filter(isMarkKey);
  } catch {
    return [];
  }
}

// Without storage other tabs don't see this tab's saves, and leave the draft to their checks.
function write(key: string, mark: Mark | null): void {
  try {
    if (mark) window.localStorage.setItem(key, JSON.stringify(mark));
    else window.localStorage.removeItem(key);
  } catch {
    // Nothing else to do: see above.
  }
}

// A closed tab's marks are removed once they have stopped counting for another minute, so a tab
// still saving has long refreshed its own before anyone could take it for gone.
function removeStale(now: number): void {
  for (const key of markKeys()) {
    const mark = readMark(key);
    if (!mark || mark.until + MARK_MS < now) write(key, null);
  }
}

export function markSending(id: string, sending: boolean): void {
  const now = Date.now();
  write(keyOf(id), sending ? { draft: id, page: PAGE, until: now + MARK_MS } : null);
  removeStale(now);
}

export function isSentElsewhere(id: string): boolean {
  const now = Date.now();
  return markKeys().some((key) => {
    const mark = readMark(key);
    return mark !== undefined && mark.draft === id && mark.page !== PAGE && mark.until > now;
  });
}

export function onOtherTabsMarks(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || isMarkKey(event.key)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
