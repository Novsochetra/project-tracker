import type { TicketDetail } from '@tracker/shared';
import { useId } from 'react';
import { DateRow, GroupedCard, SelectRow } from '../../../components';
import { LabelsRow } from '../../labels/LabelsRow';
import { useDetailFields } from '../details/useDetailFields';
import { FieldNote } from '../fields/FieldNote';
import { AssigneeRow } from './AssigneeRow';
import { DEVICE_OPTIONS, PRIORITY_OPTIONS, statusOptions } from './detailOptions';
import styles from './SidePanel.module.css';

export function DetailsCard({ detail }: { detail: TicketDetail }) {
  const { ticket } = detail;
  const fields = useDetailFields(detail);
  const { assignee } = fields;
  const labels = detail.labels ?? [];
  const noteId = useId();
  return (
    <div className={styles.section}>
      <span className={styles.label}>Details</span>
      <GroupedCard dense>
        <SelectRow
          label="Status"
          options={statusOptions(detail.statuses)}
          value={ticket.statusId}
          onChange={fields.setStatus}
        />
        <SelectRow
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={ticket.priority}
          onChange={fields.setPriority}
        />
        <SelectRow
          label="Device"
          options={DEVICE_OPTIONS}
          value={ticket.needsDevice ? 'yes' : 'no'}
          onChange={fields.setDevice}
        />
        <AssigneeRow draft={assignee} describedBy={assignee.failed ? noteId : undefined} />
        <DateRow value={ticket.due} overdue={fields.overdue} onChange={fields.setDue} />
        {labels.length > 0 && (
          <LabelsRow labels={labels} value={ticket.labelIds ?? []} onChange={fields.setLabels} />
        )}
      </GroupedCard>
      <FieldNote draft={assignee} subject="Assignee" id={noteId} />
    </div>
  );
}
