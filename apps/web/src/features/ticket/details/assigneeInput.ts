import type { ComponentProps } from 'react';
import { ASSIGNEE_MAX_LENGTH } from '../fields/limits';
import type { FieldDraftState } from '../fields/useFieldDraft';

// Saves on blur only, so the event reads "assigned the ticket to Dara", not to "D", "Da"…
function commit(draft: FieldDraftState): void {
  draft.blur();
  if (!draft.edited || draft.conflict) return;
  const name = draft.value.trim();
  draft.change(name);
  // Once a save has failed, only a retry that checks the tracker first saves again.
  if (draft.failed) draft.retry();
  else draft.save(name);
}

// The assignee field's behavior, shared by the desktop row and the phone chip.
export const assigneeInput = (draft: FieldDraftState): ComponentProps<'input'> => ({
  autoComplete: 'off',
  maxLength: ASSIGNEE_MAX_LENGTH,
  value: draft.value,
  onChange: (event) => draft.change(event.currentTarget.value),
  onFocus: draft.focus,
  onBlur: () => commit(draft),
  onKeyDown: (event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
  },
});
