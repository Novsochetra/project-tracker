import {
  formatFullDate,
  formatRelative,
  projectDisplayName,
  type TicketDetail,
} from '@tracker/shared';
import { ColorMark, GroupedCard, InfoRow } from '../../../components';
import styles from './SidePanel.module.css';

export function InfoCard({ detail, now }: { detail: TicketDetail; now: number }) {
  const { ticket, project } = detail;

  return (
    <GroupedCard>
      <InfoRow label="Project">
        <span className={styles.project}>
          <ColorMark className={styles.square} color={project.color} />
          <span className={styles.projectName}>{projectDisplayName(project)}</span>
        </span>
      </InfoRow>
      <InfoRow label="Created">{formatFullDate(ticket.createdAt)}</InfoRow>
      <InfoRow label="Updated">{formatRelative(ticket.updatedAt, now)}</InfoRow>
    </GroupedCard>
  );
}
