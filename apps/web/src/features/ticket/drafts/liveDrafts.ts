import { useEffect } from 'react';
import { useLatest } from '../../../lib/useLatest';

const live = new Map<string, { retry: () => void }>();
const openTickets = new Map<string, number>();

// The drafts of a ticket whose screen is open are left to its fields, also while it is still
// loading: the app-wide sync saving one as its field opens and retries it would save it twice.
export const isLeftToScreen = (id: string, ticketKey: string): boolean =>
  live.has(id) || openTickets.has(ticketKey);

export function useTicketOnScreen(ticketKey: string): void {
  useEffect(() => {
    openTickets.set(ticketKey, (openTickets.get(ticketKey) ?? 0) + 1);
    return () => {
      const left = (openTickets.get(ticketKey) ?? 1) - 1;
      if (left > 0) openTickets.set(ticketKey, left);
      else openTickets.delete(ticketKey);
    };
  }, [ticketKey]);
}

export function retryLiveDrafts(): void {
  live.forEach((holder) => holder.retry());
}

// A draft shown on screen is retried by its field, which shows the outcome; the app-wide sync
// only asks it to. Text kept from an earlier visit is tried as soon as the field shows it.
export function useLiveDraft(id: string, retry: () => void): void {
  const retryRef = useLatest(retry);
  useEffect(() => {
    const holder = { retry: () => retryRef.current() };
    live.set(id, holder);
    holder.retry();
    return () => {
      if (live.get(id) === holder) live.delete(id);
    };
  }, [id, retryRef]);
}
