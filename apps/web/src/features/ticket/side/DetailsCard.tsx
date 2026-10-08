import { isDoneCategory, isOverdue, type TicketDetail } from '@tracker/shared';
import { useId } from 'react';
import { DateRow, GroupedCard, SelectRow } from '../../../components';
import { FieldNote } from '../fields/FieldNote';
import { useFieldDraft } from '../fields/useFieldDraft';
import { useStatusMove } from '../useStatusMove';
import { useTicketUpdate } from '../useTicketUpdate';
import { AssigneeRow } from './AssigneeRow';
import { PRIORITY_OPTIONS, statusOptions } from './detailOptions';
import styles from './SidePanel.module.css';

export function DetailsCard({ detail }: { detail: TicketDetail }) {
  const { ticket } = detail;
  const update = useTicketUpdate(ticket.key);
  const moveTo = useStatusMove(detail);
  const done = isDoneCategory(detail.status.category);
  const assignee = useFieldDraft(
    ticket.assignee,
    { ticketKey: ticket.key, field: 'assignee' },
    (name) => update({ assignee: name }),
  );
  const noteId = useId();
  return (
    <div className={styles.section}>
      <span className={styles.label}>Details</span>
      <GroupedCard dense>
        <SelectRow
          label="Status"
          options={statusOptions(detail.statuses)}
          value={ticket.statusId}
          onChange={(statusId) => {
            const status = detail.statuses.find((candidate) => candidate.id === statusId);
            if (status) moveTo(status);
          }}
        />
        <SelectRow
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={ticket.priority}
          onChange={(priority) => {
            if (priority !== ticket.priority) void update({ priority });
          }}
        />
        <AssigneeRow draft={assignee} describedBy={assignee.failed ? noteId : undefined} />
        <DateRow
          value={ticket.due}
          overdue={isOverdue(ticket.due, done)}
          onChange={(due) => {
            if (due !== ticket.due) void update({ due });
          }}
        />
      </GroupedCard>
      <FieldNote draft={assignee} subject="Assignee" id={noteId} />
    </div>
  );
}
