import { usePeople } from '../../../api';
import { Avatar, InputRow } from '../../../components';
import { ASSIGNEE_MAX_LENGTH } from '../fields/limits';
import type { FieldDraftState } from '../fields/useFieldDraft';

export interface AssigneeRowProps {
  draft: FieldDraftState;
  // The id of the message saying the assignee isn't saved, while there is one.
  describedBy?: string | undefined;
}

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

export function AssigneeRow({ draft, describedBy }: AssigneeRowProps) {
  const people = usePeople().data;
  return (
    <InputRow
      icon={<Avatar name={draft.value} size={20} decorative />}
      label="Assignee"
      placeholder="Unassigned"
      autoComplete="off"
      maxLength={ASSIGNEE_MAX_LENGTH}
      aria-describedby={describedBy}
      suggestions={people}
      value={draft.value}
      onChange={(event) => draft.change(event.currentTarget.value)}
      onFocus={draft.focus}
      onBlur={() => commit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
      }}
    />
  );
}
