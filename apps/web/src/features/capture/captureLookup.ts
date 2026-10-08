import { listTicketsQuery, type Ticket } from '@tracker/shared';
import type { QueuedCapture } from './captureQueue';

const SEARCH_MAX_LENGTH = listTicketsQuery.shape.q.unwrap().maxLength ?? Number.POSITIVE_INFINITY;
const CLOCK_SKEW_MS = 5 * 60_000;

// Titles can be longer than a search may be, so a long one is searched by its start and the
// results are compared in full. Whole words only: the server lower-cases both sides, and a word cut
// short can lower-case differently (a Greek capital sigma turns final).
export function searchTextFor(title: string, maxLength = SEARCH_MAX_LENGTH): string {
  if (title.length <= maxLength) return title;
  const head = title.slice(0, maxLength + 1);
  const lastBreak = head.search(/\s\S*$/);
  if (lastBreak > 0) return head.slice(0, lastBreak);
  // One long word, such as a link: cut it, but never between the halves of a surrogate pair.
  const cut = title.slice(0, maxLength);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// The ticket an earlier request made for this capture, judged by its text and time.
export const matchesCapture = (ticket: Ticket, capture: QueuedCapture): boolean =>
  ticket.title === capture.title &&
  ticket.description === capture.description &&
  ticket.createdAt >= capture.capturedAt - CLOCK_SKEW_MS;
