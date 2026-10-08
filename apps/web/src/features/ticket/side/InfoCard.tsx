import { formatFullDate, formatRelative, type TicketDetail } from '@tracker/shared';
import { GroupedCard, InfoRow } from '../../../components';
import styles from './SidePanel.module.css';

export function InfoCard({ detail, now }: { detail: TicketDetail; now: number }) {
  const { ticket, project } = detail;
  return (
    <GroupedCard>
      <InfoRow label="Project">
        <span className={styles.project}>
          <span className={styles.square} style={{ background: project.color }} />
          <span className={styles.projectName}>{project.name}</span>
        </span>
      </InfoRow>
      <InfoRow label="Created">{formatFullDate(ticket.createdAt)}</InfoRow>
      <InfoRow label="Updated">{formatRelative(ticket.updatedAt, now)}</InfoRow>
    </GroupedCard>
  );
}
