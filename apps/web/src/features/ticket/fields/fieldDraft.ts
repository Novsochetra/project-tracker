export interface FieldDraft {
  value: string;
  // Typed since the field was last in step with the server; leaving the field saves it.
  edited: boolean;
  // The last save of `value` failed, or the text was kept from an earlier visit: it stays
  // until a retry saves it.
  failed: boolean;
  // Saves in flight. Until they settle, the server's value may be optimistic or rolled back.
  saving: number;
  // The tracker's value changed since the text was typed, so nothing saves it until the user
  // picks a version.
  conflict: boolean;
}

export const startDraft = (server: string): FieldDraft => ({
  value: server,
  edited: false,
  failed: false,
  saving: 0,
  conflict: false,
});

export const restoreDraft = (text: string): FieldDraft => ({
  ...startDraft(text),
  edited: true,
  failed: true,
});

export const editDraft = (draft: FieldDraft, value: string): FieldDraft =>
  draft.edited && draft.value === value ? draft : { ...draft, value, edited: true };

const holdsUnsavedText = (draft: FieldDraft): boolean => draft.saving > 0 || draft.failed;

// The server never overwrites a focused field, nor text whose save is in flight or failed (a
// rollback must not wipe what was typed). Otherwise the field follows the server: its own save
// landing, an agent's edit, or a change it missed while focused.
export function syncDraft(draft: FieldDraft, server: string, focused: boolean): FieldDraft {
  if (focused || holdsUnsavedText(draft)) return draft;
  return draft.edited || draft.value !== server ? startDraft(server) : draft;
}

export const beginSave = (draft: FieldDraft): FieldDraft => ({
  ...draft,
  saving: draft.saving + 1,
});

// Only the outcome for the text the field still shows says whether that text is saved.
export function endSave(draft: FieldDraft, value: string, saved: boolean): FieldDraft {
  const settled = { ...draft, saving: Math.max(0, draft.saving - 1) };
  return draft.value === value ? { ...settled, failed: !saved } : settled;
}

// A check counts only while the field still shows the text it was made for.
export function checkedDraft(
  draft: FieldDraft,
  value: string,
  check: 'saved' | 'changed',
): FieldDraft {
  if (draft.value !== value) return draft;
  return check === 'saved' ? { ...draft, failed: false } : { ...draft, conflict: true };
}

export const keepMine = (draft: FieldDraft): FieldDraft => ({ ...draft, conflict: false });
