import { useMemo, useSyncExternalStore } from 'react';
import { subscribeStoredDrafts } from '../../../lib/storedDrafts';
import { draftedLines } from './lineDrafts';

export function useDraftedLines(ticketKey: string): ReadonlySet<string> {
  const lines = useSyncExternalStore(subscribeStoredDrafts, () => draftedLines(ticketKey));
  return useMemo(() => new Set(lines ? lines.split('\n') : []), [lines]);
}
