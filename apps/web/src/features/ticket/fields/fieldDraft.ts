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
  // Text the tracker has, or may have, that this tab's copy of the ticket may not show: another
  // tab's save of it landed while that copy still had `stale`, or was on its way when the field
  // was typed over. Saves compare with it and name it as typed over: an edit back to the older
  // text must not look like no change, nor let that save land after it. While the copy still has
  // `stale`, the field keeps showing `text`, so typing goes on top of it.
  landed?: { text: string; stale?: string };
  // The tracker refused the save of `value` because it was typed over text the tracker didn't
  // have yet (another tab's save still on its way). Only a check settles it: the drafts store
  // letting the text go doesn't, because another tab can drop it from a copy of the store that
  // hadn't heard of this text yet.
  refused?: boolean;
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

export function editDraft(draft: FieldDraft, value: string): FieldDraft {
  if (draft.edited && draft.value === value) return draft;
  const landed = draft.carried ? { text: draft.value } : draft.landed;
  return { ...draft, value, edited: true, carried: false, landed };
}

// The save of the shown text landed, so the tracker has it, though this tab's copy of the ticket
// may not yet.
const landedDraft = (value: string, server: string): FieldDraft =>
  value === server
    ? startDraft(value)
    : { ...startDraft(value), landed: { text: value, stale: server } };

// What the drafts store says once nothing is on its way. This tab keeps the store in step with
// what it types, so other kept text was typed in another tab: the field shows it, unsaved, like
// text kept from an earlier visit, so both tabs edit the same text and neither types over text it
// hasn't shown. Text the store no longer keeps was saved (or dropped elsewhere), and text it
// still keeps after its save was not.
function settledDraft(draft: FieldDraft, kept: string | undefined, server: string): FieldDraft {
  if (kept !== undefined && kept !== draft.value) return restoreDraft(kept, false);
  if (draft.carried) {
    return kept === undefined
      ? landedDraft(draft.value, server)
      : { ...draft, carried: false, failed: true };
  }
  if (kept === undefined && (draft.failed || draft.conflict) && !draft.refused) {
    return { ...draft, failed: false, conflict: false };
  }
  return draft;
}

// While another tab sends the kept text, the field shows it without a note, and that save's
// outcome settles it, as for a field opened while a save of its text is on its way. A refused
// edit waits for that save with its note: it isn't the text being sent.
function sentElsewhere(draft: FieldDraft, kept: string | undefined): FieldDraft {
  if (kept === undefined || draft.conflict || draft.refused) return draft;
  return draft.value === kept && !draft.failed ? draft : restoreDraft(kept, true);
}

// The server never overwrites a focused field, nor text whose save is in flight or failed (a
// rollback must not wipe what was typed). Otherwise the field follows the server: its own save
// landing, an agent's edit, or a change it missed while focused.
export function syncDraft(draft: FieldDraft, server: string, context: FieldContext): FieldDraft {
  if (context.saving) return draft;
  if (context.sentElsewhere) return sentElsewhere(draft, context.kept);
  const settled = settledDraft(draft, context.kept, server);
  if (context.focused || settled.failed || settled.landed?.stale === server) return settled;
  const inStep = !settled.edited && settled.value === server && settled.landed === undefined;
  return inStep ? settled : startDraft(server);
}

// The tracker already has `value`, so nothing was sent for it.
export const markSaved = (draft: FieldDraft, value: string): FieldDraft =>
  draft.value === value ? { ...draft, failed: false, carried: false, refused: undefined } : draft;

// Only the outcome for the text the field still shows says whether that text is saved. Once its
// own save landed, the field's copy has it, so another tab's landed text no longer counts.
export function endSave(draft: FieldDraft, value: string, saved: boolean): FieldDraft {
  if (!saved) return draft.value === value ? { ...draft, failed: true, carried: false } : draft;
  return draft.value === value ? { ...markSaved(draft, value), landed: undefined } : draft;
}

export const refuseSave = (draft: FieldDraft, value: string): FieldDraft =>
  draft.value === value ? { ...endSave(draft, value, false), refused: true } : draft;

// A check counts only while the field still shows the text it was made for.
export function checkedDraft(
  draft: FieldDraft,
  value: string,
  check: 'saved' | 'changed',
): FieldDraft {
  if (draft.value !== value) return draft;
  const checked = { ...draft, refused: undefined };
  return check === 'saved' ? { ...checked, failed: false } : { ...checked, conflict: true };
}

export const keepMine = (draft: FieldDraft): FieldDraft => ({ ...draft, conflict: false });
