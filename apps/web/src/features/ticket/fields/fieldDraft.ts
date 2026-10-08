export interface FieldDraft {
  value: string;
  // Typed since the field was last in step with the server; leaving the field saves it.
  edited: boolean;
  // The last save of `value` failed, or the text was kept from an earlier visit: it stays
  // until a retry saves it.
  failed: boolean;
  // Opened again while the latest save of `value`, sent before, is still on its way. That save's
  // outcome reaches only the field that sent it, so this one reads it from the drafts store.
  carried: boolean;
  // The tracker's value changed since the text was typed, so nothing saves it until the user
  // picks a version.
  conflict: boolean;
}

export interface FieldContext {
  focused: boolean;
  // A save of the field is on its way, sent by this field or by one shown before it.
  saving: boolean;
  // Another tab has a save of the field on its way.
  sentElsewhere?: boolean;
  // The text the drafts store keeps for the field, which it keeps until the tracker has it.
  kept: string | undefined;
}

export const startDraft = (server: string): FieldDraft => ({
  value: server,
  edited: false,
  failed: false,
  carried: false,
  conflict: false,
});

export const restoreDraft = (text: string, carried: boolean): FieldDraft => ({
  ...startDraft(text),
  edited: true,
  failed: !carried,
  carried,
});

export const editDraft = (draft: FieldDraft, value: string): FieldDraft =>
  draft.edited && draft.value === value ? draft : { ...draft, value, edited: true, carried: false };

// Once nothing is on its way, text the store no longer keeps is saved (or dropped elsewhere),
// and text it still keeps after its save is not.
function settledDraft(draft: FieldDraft, kept: string | undefined): FieldDraft {
  if (draft.carried) return { ...draft, carried: false, failed: kept === draft.value };
  if (kept === undefined && (draft.failed || draft.conflict)) {
    return { ...draft, failed: false, conflict: false };
  }
  return draft;
}

// This tab keeps the store in step with what it types, so other kept text was typed in another
// tab. The field shows it, unsaved, like text kept from an earlier visit: both tabs then edit
// the same text, and neither types over text it hasn't shown.
function adoptedDraft(draft: FieldDraft, kept: string | undefined): FieldDraft {
  return kept === undefined || kept === draft.value ? draft : restoreDraft(kept, false);
}

// While another tab sends the kept text, the field shows it without a note, and that save's
// outcome settles it, as for a field opened while a save of its text is on its way.
function sentElsewhere(draft: FieldDraft, kept: string | undefined): FieldDraft {
  if (kept === undefined || draft.conflict) return draft;
  return draft.value === kept && !draft.failed ? draft : restoreDraft(kept, true);
}

// The server never overwrites a focused field, nor text whose save is in flight or failed (a
// rollback must not wipe what was typed). Otherwise the field follows the server: its own save
// landing, an agent's edit, or a change it missed while focused.
export function syncDraft(draft: FieldDraft, server: string, context: FieldContext): FieldDraft {
  if (context.saving) return draft;
  if (context.sentElsewhere) return sentElsewhere(draft, context.kept);
  const settled = adoptedDraft(settledDraft(draft, context.kept), context.kept);
  if (context.focused || settled.failed) return settled;
  return settled.edited || settled.value !== server ? startDraft(server) : settled;
}

// Only the outcome for the text the field still shows says whether that text is saved.
export function endSave(draft: FieldDraft, value: string, saved: boolean): FieldDraft {
  return draft.value === value ? { ...draft, failed: !saved, carried: false } : draft;
}

// The tracker already has `value`, so nothing was sent for it.
export const markSaved = (draft: FieldDraft, value: string): FieldDraft =>
  endSave(draft, value, true);

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
