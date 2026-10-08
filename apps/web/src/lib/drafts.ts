import { hasUnstoredSheetDrafts } from './sheetDrafts';
import { hasStoredDrafts } from './storedDrafts';

// Counted per id: two mounted components can mark the same draft, and the first to let go
// must not clear the other's mark.
const marks = new Map<string, number>();

// Marks unsent text a reload would lose, so an app update waits until clearDraft(id).
export function markDraft(id: string): void {
  marks.set(id, (marks.get(id) ?? 0) + 1);
}

export function clearDraft(id: string): void {
  const count = marks.get(id) ?? 0;
  if (count > 1) marks.set(id, count - 1);
  else marks.delete(id);
}

// Text kept in the ticket drafts store survives a reload but isn't saved yet, so it counts too.
// Sheet drafts don't: a reload loses nothing, since the sheet opens with them again, unless
// storage refused them.
export const hasDrafts = (): boolean =>
  marks.size > 0 || hasStoredDrafts() || hasUnstoredSheetDrafts();

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
