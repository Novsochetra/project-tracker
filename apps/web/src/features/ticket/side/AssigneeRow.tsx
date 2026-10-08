import { usePeople } from '../../../api';
import { Avatar, InputRow } from '../../../components';
import { useFieldDraft } from '../fields/useFieldDraft';

export interface AssigneeRowProps {
  assignee: string;
  onSave: (assignee: string) => void;
}

/** Saves on blur only, so the event reads "assigned the ticket to Dara", not to "D", "Da"… */
export function AssigneeRow({ assignee, onSave }: AssigneeRowProps) {
  const draft = useFieldDraft(assignee);
  const people = usePeople().data;
  const commit = () => {
    draft.blur();
    const next = draft.value.trim();
    if (draft.edited && next !== assignee) onSave(next);
    else draft.reset();
  };
  return (
    <InputRow
      icon={<Avatar name={draft.value} size={20} decorative />}
      label="Assignee"
      placeholder="Unassigned"
      autoComplete="off"
      suggestions={people}
      value={draft.value}
      onChange={(event) => draft.change(event.currentTarget.value)}
      onFocus={draft.focus}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
      }}
    />
  );
}
