import { isDoneCategory, isOverdue, type Label, type Status } from '@tracker/shared';
import type { ClipboardEvent, ReactNode, RefObject } from 'react';
import { usePeople } from '../../api';
import {
  AutoTextarea,
  Avatar,
  DateRow,
  GroupedCard,
  InputRow,
  SelectRow,
  TitleField,
} from '../../components';
import { pasteFiles } from '../attachments';
import { LabelsRow } from '../labels/LabelsRow';
import { PRIORITY_OPTIONS, statusOptions } from './fieldOptions';
import styles from './NewTicketSheet.module.css';
import { TITLE_MAX_LENGTH, type NewTicketForm } from './newTicketForm';
import { withLabels } from './newTicketLabels';

export interface NewTicketFieldsProps {
  form: NewTicketForm;
  statuses: readonly Status[];
  labels: readonly Label[];
  statusId: string | undefined;
  error: string;
  titleRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: Partial<NewTicketForm>) => void;
  onEnter: () => void;
  onFiles: (files: File[]) => void;
  attachments: ReactNode;
}

export function NewTicketFields(props: NewTicketFieldsProps) {
  const { form, statuses, statusId, error, titleRef, onChange, onEnter, onFiles } = props;
  const onPaste = (event: ClipboardEvent<HTMLElement>) => pasteFiles(event, onFiles);
  const people = usePeople().data;
  const status = statuses.find((candidate) => candidate.id === statusId);
  const isDone = status ? isDoneCategory(status.category) : false;
  return (
    <>
      <div className={styles.text}>
        <TitleField
          ref={titleRef}
          aria-label="Ticket title"
          placeholder="Ticket title"
          maxLength={TITLE_MAX_LENGTH}
          value={form.title}
          onChange={(title) => onChange({ title })}
          onEnter={onEnter}
          onPaste={onPaste}
        />
        <AutoTextarea
          className={styles.description}
          aria-label="Description"
          placeholder="Add details, steps or acceptance criteria…"
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.currentTarget.value })}
          onPaste={onPaste}
        />
      </div>
      {props.attachments}
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
          {props.labels.length > 0 && (
            <LabelsRow
              labels={props.labels}
              value={form.labelIds}
              onChange={(ids) => onChange(withLabels(form, ids, props.labels))}
            />
          )}
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
