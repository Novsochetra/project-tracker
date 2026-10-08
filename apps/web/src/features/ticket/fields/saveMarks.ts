import { storedMap } from '../../../lib/storedMap';

// The saves of a draft on their way live in the memory of the tab that sent them. Other tabs
// can't see that, and their app-wide sync would take the tracker having the first of them for a
// change, so each tab also marks the drafts it is sending in storage, until a time after which a
// tab that closed while sending stops counting.
export const SAVE_MARKS_STORAGE_KEY = 'tracker.draftSaves';
const MARK_MS = 60_000;

const PAGE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

interface Mark {
  page: string;
  until: number;
}

const isMark = (value: unknown): value is Mark =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Mark).page === 'string' &&
  typeof (value as Mark).until === 'number';

// Without storage other tabs don't see this tab's saves, and leave the draft to their checks.
const marks = storedMap(SAVE_MARKS_STORAGE_KEY, isMark);

export function markSending(id: string, sending: boolean): void {
  const now = Date.now();
  const others = Object.entries(marks.read()).filter(
    ([markId, mark]) => mark.until > now && !(markId === id && mark.page === PAGE),
  );
  const own = sending ? [[id, { page: PAGE, until: now + MARK_MS }] as const] : [];
  marks.write(Object.fromEntries([...others, ...own]));
}

export function isSentElsewhere(id: string): boolean {
  const mark = marks.read()[id];
  return mark !== undefined && mark.page !== PAGE && mark.until > Date.now();
}

export function onOtherTabsMarks(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SAVE_MARKS_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
