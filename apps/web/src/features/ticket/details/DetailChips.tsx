import type { TicketDetail } from '@tracker/shared';
import { useId } from 'react';
import { FieldNote } from '../fields/FieldNote';
import { DEVICE_OPTIONS, PRIORITY_OPTIONS, statusOptions } from '../side/detailOptions';
import { AssigneeChip } from './AssigneeChip';
import styles from './DetailChips.module.css';
import { DueChip } from './DueChip';
import { LabelsChip } from './LabelsChip';
import { SelectChip } from './SelectChip';
import { useDetailFields } from './useDetailFields';

// Phones show the ticket's details as chips under its title instead of the side panel's card,
// which stacked into the middle of the page (docs/architecture.md §1.7).
export function DetailChips({ detail }: { detail: TicketDetail }) {
  const { ticket } = detail;
  const fields = useDetailFields(detail);
  const { assignee } = fields;
  const labels = detail.labels ?? [];
  const noteId = useId();
  return (
    <>
      <div role="group" aria-label="Details" className={styles.chips}>
        <SelectChip
          label="Status"
          options={statusOptions(detail.statuses)}
          value={ticket.statusId}
          onChange={fields.setStatus}
        />
        <SelectChip
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={ticket.priority}
          onChange={fields.setPriority}
        />
        <SelectChip
          label="Device"
          options={DEVICE_OPTIONS}
          value={ticket.needsDevice ? 'yes' : 'no'}
          onChange={fields.setDevice}
        />
        <AssigneeChip draft={assignee} describedBy={assignee.failed ? noteId : undefined} />
        <DueChip value={ticket.due} overdue={fields.overdue} onChange={fields.setDue} />
        {labels.length > 0 && (
          <LabelsChip labels={labels} value={ticket.labelIds ?? []} onChange={fields.setLabels} />
        )}
      </div>
      <FieldNote draft={assignee} subject="Assignee" id={noteId} />
    </>
  );
}
