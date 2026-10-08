import type { QueryClient } from '@tanstack/react-query';

export const FRESH_READS_STORAGE_KEY = 'tracker.freshReads';

// After a write, or a change a live update reports, the ticket is read from the tracker itself
// until such a read lands. The copy the service worker saved before the change would otherwise
// show the old text whenever a read takes longer than its timeout.
const changesSinceRead = new WeakMap<QueryClient, Map<string, number>>();

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

function takeStoredMarks(): Map<string, number> {
  try {
    const raw = window.sessionStorage.getItem(FRESH_READS_STORAGE_KEY);
    window.sessionStorage.removeItem(FRESH_READS_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return new Map();
    return new Map(
      Object.entries(parsed).filter((entry): entry is [string, number] => isCount(entry[1])),
    );
  } catch {
    return new Map();
  }
}

// The first reader takes over what the page before a reload hadn't read fresh yet.
function marksOf(queryClient: QueryClient): Map<string, number> {
  let tickets = changesSinceRead.get(queryClient);
  if (!tickets) {
    tickets = takeStoredMarks();
    changesSinceRead.set(queryClient, tickets);
  }
  return tickets;
}

const canonical = (ticketKey: string): string => ticketKey.toUpperCase();

export function markChanged(queryClient: QueryClient, ticketKey: string): void {
  const tickets = marksOf(queryClient);
  const key = canonical(ticketKey);
  tickets.set(key, (tickets.get(key) ?? 0) + 1);
}

export const changesBefore = (queryClient: QueryClient, ticketKey: string): number | undefined =>
  marksOf(queryClient).get(canonical(ticketKey));

// A change that settled while the fresh read was on its way waits for a read of its own.
export function markRead(queryClient: QueryClient, ticketKey: string, changes: number): void {
  const tickets = marksOf(queryClient);
  const key = canonical(ticketKey);
  if (tickets.get(key) === changes) tickets.delete(key);
}

function storeMarks(tickets: Map<string, number>): void {
  const marks = JSON.stringify(Object.fromEntries(tickets));
  try {
    if (tickets.size > 0) window.sessionStorage.setItem(FRESH_READS_STORAGE_KEY, marks);
    else window.sessionStorage.removeItem(FRESH_READS_STORAGE_KEY);
  } catch {
    // Without session storage the next page reads as usual.
  }
}

// A reload in the seconds after a save (an app update reloads as soon as the save lands) would
// otherwise read as usual, and the service worker would answer with its copy from before it,
// because the fresh read that replaces that copy went with the old page.
export function keepFreshReadsOnReload(queryClient: QueryClient): () => void {
  const store = () => storeMarks(marksOf(queryClient));
  window.addEventListener('pagehide', store);
  return () => window.removeEventListener('pagehide', store);
}
