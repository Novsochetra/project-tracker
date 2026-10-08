import { useEffect } from 'react';
import { useLatest } from '../../../lib/useLatest';

const live = new Map<string, { retry: () => void }>();

export const isLiveDraft = (id: string): boolean => live.has(id);

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
