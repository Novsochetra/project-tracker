import { isDoneCategory, isOverdue, type TicketDetail } from '@tracker/shared';
import { DateRow, GroupedCard, SelectRow } from '../../../components';
import { useTicketUpdate } from '../useTicketUpdate';
import { AssigneeRow } from './AssigneeRow';
import { PRIORITY_OPTIONS, statusOptions } from './detailOptions';
import styles from './SidePanel.module.css';

export function DetailsCard({ detail }: { detail: TicketDetail }) {
  const { ticket } = detail;
  const update = useTicketUpdate(ticket.key);
  const done = isDoneCategory(detail.status.category);
  return (
    <div className={styles.section}>
      <span className={styles.label}>Details</span>
      <GroupedCard dense>
        <SelectRow
          label="Status"
          options={statusOptions(detail.statuses)}
          value={ticket.statusId}
          onChange={(statusId) => {
            if (statusId !== ticket.statusId) update({ statusId });
          }}
        />
        <SelectRow
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={ticket.priority}
          onChange={(priority) => {
            if (priority !== ticket.priority) update({ priority });
          }}
        />
        <AssigneeRow assignee={ticket.assignee} onSave={(assignee) => update({ assignee })} />
        <DateRow
          value={ticket.due}
          overdue={isOverdue(ticket.due, done)}
          onChange={(due) => {
            if (due !== ticket.due) update({ due });
          }}
        />
      </GroupedCard>
    </div>
  );
}
