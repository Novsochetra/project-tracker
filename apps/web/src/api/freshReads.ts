import type { QueryClient } from '@tanstack/react-query';

const writesSinceRead = new WeakMap<QueryClient, Map<string, number>>();

// After a write, the ticket is read from the tracker itself until such a read lands. The copy
// the service worker saved before the write would otherwise replace the written text on screen
// whenever a read takes longer than its timeout.
export function markWritten(queryClient: QueryClient, ticketKey: string): void {
  const tickets = writesSinceRead.get(queryClient) ?? new Map<string, number>();
  tickets.set(ticketKey, (tickets.get(ticketKey) ?? 0) + 1);
  writesSinceRead.set(queryClient, tickets);
}

export const writesBefore = (queryClient: QueryClient, ticketKey: string): number | undefined =>
  writesSinceRead.get(queryClient)?.get(ticketKey);

// A write that settled while the fresh read was on its way waits for a read of its own.
export function markRead(queryClient: QueryClient, ticketKey: string, writes: number): void {
  const tickets = writesSinceRead.get(queryClient);
  if (tickets?.get(ticketKey) === writes) tickets.delete(ticketKey);
}
