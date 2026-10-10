import { holdPageLock, whenPageGone } from './pageLocks';

// The saves of a draft on their way live in the memory of the tab that sent them. Other tabs
// can't see that, and their app-wide sync would take the tracker having the first of them for a
// change, so each tab also marks the drafts it is sending in storage, until a time after which a
// tab that closed while sending stops counting.
export const SAVE_MARKS_STORAGE_KEY = 'tracker.draftSaves';
const MARK_MS = 60_000;

const PAGE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
holdPageLock(PAGE);

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

// Other tabs' marks that still count.
function otherMarks(now: number): Mark[] {
  return markKeys()
    .map(readMark)
    .filter((mark): mark is Mark => mark !== undefined && mark.page !== PAGE && mark.until > now);
}

export const isSentElsewhere = (id: string): boolean =>
  otherMarks(Date.now()).some((mark) => mark.draft === id);

function removeMarksOf(page: string): void {
  for (const key of markKeys()) {
    if (readMark(key)?.page === page) write(key, null);
  }
}

// A tab that goes for good (closed, reloaded) takes its saves with it, so its marks go at once
// rather than a minute later. Not one the browser keeps to show again: its saves may still answer.
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) removeMarksOf(PAGE);
});

// Told apart because only 'left' leaves saves unsettled: a tab went (one whose marks this tab has
// read) or one of its marks ran out. A mark written or removed is mostly a save its tab settles.
export type MarksNews = 'changed' | 'left';

const pageLeft = new Set<() => void>();

// A page that went without removing its marks (killed, or its removal lost as it closed) is known
// by its lock coming free, and its marks go then.
function watchPages(marks: readonly Mark[]): void {
  for (const { page } of marks) {
    whenPageGone(page, () => {
      removeMarksOf(page);
      pageLeft.forEach((listener) => listener());
    });
  }
}

// Nothing tells a tab when another tab's mark runs out (that tab closed without a word), so the
// listener also hears when the next one does.
export function onOtherTabsMarks(listener: (news: MarksNews) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wakeAtNextEnd = () => {
    clearTimeout(timer);
    const now = Date.now();
    const marks = otherMarks(now);
    watchPages(marks);
    if (marks.length === 0) return;
    timer = setTimeout(() => hear('left'), Math.min(...marks.map((mark) => mark.until)) - now);
  };
  const hear = (news: MarksNews) => {
    wakeAtNextEnd();
    listener(news);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !isMarkKey(event.key)) return;
    hear('changed');
  };
  const onPageLeft = () => hear('left');
  window.addEventListener('storage', onStorage);
  pageLeft.add(onPageLeft);
  wakeAtNextEnd();
  return () => {
    clearTimeout(timer);
    window.removeEventListener('storage', onStorage);
    pageLeft.delete(onPageLeft);
  };
}
