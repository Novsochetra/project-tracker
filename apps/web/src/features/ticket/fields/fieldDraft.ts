export interface FieldDraft {
  value: string;
  /** The server value at the last sync, so only a real server change replaces the draft. */
  seen: string;
  /** Typed since the last sync; kept until the save shows up on the server. */
  edited: boolean;
}

export const startDraft = (server: string): FieldDraft => ({
  value: server,
  seen: server,
  edited: false,
});

export const editDraft = (draft: FieldDraft, value: string): FieldDraft =>
  draft.edited && draft.value === value ? draft : { ...draft, value, edited: true };

/**
 * While the field has focus the server never overwrites it, but its changes are noted. Once
 * the field is left, a server change wins (a save landing, a rollback, an agent's edit), and
 * an untouched field catches up with changes it missed while focused.
 */
export function syncDraft(draft: FieldDraft, server: string, focused: boolean): FieldDraft {
  if (server !== draft.seen) return focused ? { ...draft, seen: server } : startDraft(server);
  if (focused || draft.edited || draft.value === server) return draft;
  return startDraft(server);
}
