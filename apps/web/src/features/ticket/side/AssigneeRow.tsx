import { usePeople } from '../../../api';
import { Avatar, InputRow } from '../../../components';
import { assigneeInput } from '../details/assigneeInput';
import type { FieldDraftState } from '../fields/useFieldDraft';

export interface AssigneeRowProps {
  draft: FieldDraftState;
  describedBy?: string | undefined;
}

export function AssigneeRow({ draft, describedBy }: AssigneeRowProps) {
  const people = usePeople().data;
  return (
    <InputRow
      icon={<Avatar name={draft.value} size={20} decorative />}
      label="Assignee"
      placeholder="Unassigned"
      aria-describedby={describedBy}
      suggestions={people}
      {...assigneeInput(draft)}
    />
  );
}
