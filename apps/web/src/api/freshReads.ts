import type { QueryClient } from '@tanstack/react-query';

// Per ticket, the writes that settled since the tracker last answered a read of it.
const written = new WeakMap<QueryClient, Map<string, number>>();

// After a write, the ticket is read from the tracker itself until such a read lands. The copy
// the service worker saved before the write would otherwise replace the written text on screen
// whenever a read takes longer than its timeout.
export function markWritten(queryClient: QueryClient, ticketKey: string): void {
  const tickets = written.get(queryClient) ?? new Map<string, number>();
  tickets.set(ticketKey, (tickets.get(ticketKey) ?? 0) + 1);
  written.set(queryClient, tickets);
}

// The writes a read starts after, or undefined when the ticket can be read as usual.
export const writesBefore = (queryClient: QueryClient, ticketKey: string): number | undefined =>
  written.get(queryClient)?.get(ticketKey);

// A fresh read landed. A write that settled while it was on its way waits for a read of its own.
export function markRead(queryClient: QueryClient, ticketKey: string, writes: number): void {
  const tickets = written.get(queryClient);
  if (tickets?.get(ticketKey) === writes) tickets.delete(ticketKey);
}
