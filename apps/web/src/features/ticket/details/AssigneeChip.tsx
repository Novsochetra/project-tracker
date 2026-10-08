import clsx from 'clsx';
import { useId, useState } from 'react';
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

// The chip is as wide as the name: an unseen copy of it sizes the cell the field fills. iOS Safari
// keeps room for a hidden suggestions button in a field with a list, which cut the name short
// ("Claude (le…"), so the list is only there while the name is being edited; the chip then takes
// its whole row.
export function AssigneeChip({ draft, describedBy }: AssigneeChipProps) {
  const people = usePeople().data;
  const listId = useId();
  const [editing, setEditing] = useState(false);
  const input = assigneeInput(draft);
  return (
    <label className={clsx(styles.chip, styles.field)}>
      <Avatar name={draft.value} size={20} decorative />
      <span className={styles.sizer} data-text={draft.value || PLACEHOLDER}>
        <input
          className={styles.input}
          size={1}
          aria-label="Assignee"
          placeholder={PLACEHOLDER}
          aria-describedby={describedBy}
          {...input}
          list={editing && people ? listId : undefined}
          onFocus={(event) => {
            setEditing(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setEditing(false);
            input.onBlur?.(event);
          }}
        />
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
