const drafts = new Set<string>();

/** Marks unsent text a reload would lose, so an app update waits until clearDraft(id). */
export function markDraft(id: string): void {
  drafts.add(id);
}

export function clearDraft(id: string): void {
  drafts.delete(id);
}

export const hasDrafts = (): boolean => drafts.size > 0;
