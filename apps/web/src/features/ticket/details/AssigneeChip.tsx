import clsx from 'clsx';
import { useId } from 'react';
import { usePeople } from '../../../api';
import { Avatar } from '../../../components';
import type { FieldDraftState } from '../fields/useFieldDraft';
import { assigneeInput } from './assigneeInput';
import styles from './DetailChips.module.css';

export interface AssigneeChipProps {
  draft: FieldDraftState;
  describedBy?: string | undefined;
}

const PLACEHOLDER = 'Unassigned';

// The name shows from a plain copy of it, which also sizes the chip; the field's own text shows
// only while it is edited. iOS Safari keeps room for the suggestions button inside a field with a
// list, even after the list is gone, which cut the field's text short ("Claude (le…").
export function AssigneeChip({ draft, describedBy }: AssigneeChipProps) {
  const people = usePeople().data;
  const listId = useId();
  return (
    <label className={clsx(styles.chip, styles.field)}>
      <Avatar name={draft.value} size={20} decorative />
      <span className={styles.sizer}>
        <input
          className={styles.input}
          size={1}
          aria-label="Assignee"
          placeholder={PLACEHOLDER}
          aria-describedby={describedBy}
          list={people ? listId : undefined}
          {...assigneeInput(draft)}
        />
        <span className={clsx(styles.name, !draft.value && styles.unset)} aria-hidden="true">
          {draft.value || PLACEHOLDER}
        </span>
      </span>
      {people && (
        <datalist id={listId}>
          {people.map((person) => (
            <option key={person} value={person} />
          ))}
        </datalist>
      )}
    </label>
  );
}
