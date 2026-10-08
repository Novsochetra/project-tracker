import { hasStoredDrafts } from './storedDrafts';

const drafts = new Set<string>();

// Marks unsent text a reload would lose, so an app update waits until clearDraft(id).
export function markDraft(id: string): void {
  drafts.add(id);
}

export function clearDraft(id: string): void {
  drafts.delete(id);
}

// Text kept in the drafts store survives a reload but isn't saved yet, so it counts too.
export const hasDrafts = (): boolean => drafts.size > 0 || hasStoredDrafts();

function askBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasDrafts()) return;
  event.preventDefault();
  // Chrome before 119 only asks when returnValue is set.
  event.returnValue = true;
}

export function guardUnload(): () => void {
  window.addEventListener('beforeunload', askBeforeUnload);
  return () => window.removeEventListener('beforeunload', askBeforeUnload);
}
