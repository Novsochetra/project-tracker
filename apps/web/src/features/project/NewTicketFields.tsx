import { isDoneCategory, isOverdue, type Status } from '@tracker/shared';
import type { KeyboardEvent, RefObject } from 'react';
import { usePeople } from '../../api';
import { AutoTextarea, Avatar, DateRow, GroupedCard, InputRow, SelectRow } from '../../components';
import { PRIORITY_OPTIONS, statusOptions } from './fieldOptions';
import styles from './NewTicketSheet.module.css';
import type { NewTicketForm } from './newTicketForm';

export interface NewTicketFieldsProps {
  form: NewTicketForm;
  statuses: readonly Status[];
  statusId: string | undefined;
  error: string;
  titleRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<NewTicketForm>) => void;
  onEnter: () => void;
}

export function NewTicketFields(props: NewTicketFieldsProps) {
  const { form, statuses, statusId, error, titleRef, onChange, onEnter } = props;
  const people = usePeople().data;
  const status = statuses.find((candidate) => candidate.id === statusId);
  const isDone = status ? isDoneCategory(status.category) : false;
  // Enter must reach the validation even while Create is disabled, which blocks implicit submit.
  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <>
      <div className={styles.text}>
        <input
          ref={titleRef}
          className={styles.title}
          aria-label="Ticket title"
          placeholder="Ticket title"
          value={form.title}
          onChange={(event) => onChange({ title: event.currentTarget.value })}
          onKeyDown={onTitleKeyDown}
        />
        <AutoTextarea
          className={styles.description}
          aria-label="Description"
          placeholder="Add details, steps or acceptance criteria…"
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.currentTarget.value })}
        />
      </div>
      <div className={styles.details}>
        <GroupedCard>
          <SelectRow
            label="Status"
            options={statusOptions(statuses)}
            value={statusId ?? ''}
            onChange={(next) => onChange({ statusId: next })}
          />
          <SelectRow
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(priority) => onChange({ priority })}
          />
          <InputRow
            icon={<Avatar name={form.assignee} size={20} decorative />}
            label="Assignee"
            placeholder="Unassigned"
            value={form.assignee}
            suggestions={people}
            onChange={(event) => onChange({ assignee: event.currentTarget.value })}
          />
          <DateRow
            value={form.due}
            onChange={(due) => onChange({ due })}
            overdue={isOverdue(form.due, isDone)}
            mutedIcon
          />
        </GroupedCard>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </>
  );
}
