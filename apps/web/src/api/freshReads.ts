import type { QueryClient } from '@tanstack/react-query';
import { storedMap, type StoredMap } from '../lib/storedMap';

export const FRESH_READS_STORAGE_KEY = 'tracker.freshReads';

// A change nobody read fresh after, because the page went in the seconds after it, still counts
// this long for pages opened later: a new tab, or the app after iOS stopped it, which starts a new
// session. Marks go as soon as some page reads the ticket fresh.
export const FRESH_READ_MARK_MS = 24 * 60 * 60 * 1000;

// After a write, or a change a live update reports, the ticket is read from the tracker itself
// until such a read lands. The copy the service worker saved before the change would otherwise
// show the old text whenever the network drops a read.
const changesSinceRead = new WeakMap<QueryClient, Map<string, number>>();

// The stored mark each ticket had when this page's fresh read of it started.
const storedAtRead = new Map<string, number | undefined>();

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// Without storage only this page reads fresh, and a page opened later reads as usual.
const stored = storedMap(FRESH_READS_STORAGE_KEY, isTime);

function readStoredMarks(): StoredMap<number> {
  const since = Date.now() - FRESH_READ_MARK_MS;
  return Object.fromEntries(Object.entries(stored.read()).filter(([, time]) => time > since));
}

const writeStoredMarks = (marks: StoredMap<number>): void => void stored.write(marks);

// A page starts with the tickets other pages, also earlier ones, changed and nobody read fresh.
function marksOf(queryClient: QueryClient): Map<string, number> {
  let tickets = changesSinceRead.get(queryClient);
  if (!tickets) {
    tickets = new Map(Object.keys(readStoredMarks()).map((key) => [key, 0]));
    changesSinceRead.set(queryClient, tickets);
  }
  return tickets;
}

const canonical = (ticketKey: string): string => ticketKey.toUpperCase();

export function markChanged(queryClient: QueryClient, ticketKey: string): void {
  const tickets = marksOf(queryClient);
  const key = canonical(ticketKey);
  tickets.set(key, (tickets.get(key) ?? 0) + 1);
  writeStoredMarks({ ...readStoredMarks(), [key]: Date.now() });
}

export function changesBefore(queryClient: QueryClient, ticketKey: string): number | undefined {
  const key = canonical(ticketKey);
  const changes = marksOf(queryClient).get(key);
  if (changes !== undefined) storedAtRead.set(key, readStoredMarks()[key]);
  return changes;
}

// A change that settled while the fresh read was on its way waits for a read of its own, also
// one another page made.
export function markRead(queryClient: QueryClient, ticketKey: string, changes: number): void {
  const tickets = marksOf(queryClient);
  const key = canonical(ticketKey);
  if (tickets.get(key) !== changes) return;
  tickets.delete(key);
  const { [key]: stored, ...rest } = readStoredMarks();
  if (stored !== undefined && stored === storedAtRead.get(key)) writeStoredMarks(rest);
}
