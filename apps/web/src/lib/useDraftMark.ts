import { useEffect } from 'react';
import { clearDraft, markDraft } from './drafts';

// Keeps an app update from reloading the page while `active` text would be lost (drafts contract).
export function useDraftMark(id: string, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    markDraft(id);
    return () => clearDraft(id);
  }, [id, active]);
}
