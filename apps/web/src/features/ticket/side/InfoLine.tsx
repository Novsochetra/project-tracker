import {
  formatFullDate,
  formatRelative,
  projectDisplayName,
  type TicketDetail,
} from '@tracker/shared';
import styles from './SidePanel.module.css';

// The phone's stand-in for the Info card: rarely needed, so one quiet line at the end of the
// ticket instead of a card between the description and the activity.
export function InfoLine({ detail, now }: { detail: TicketDetail; now: number }) {
  const { ticket, project } = detail;
  return (
    <p className={styles.infoLine}>
      <span className={styles.project}>
        <span className={styles.square} style={{ background: project.color }} />
        {!project.hideName && <span className="visually-hidden">Project </span>}
        <span className={styles.projectName}>{projectDisplayName(project)}</span>
      </span>{' '}
      <span className={styles.part}>Created {formatFullDate(ticket.createdAt)}</span>{' '}
      <span className={styles.part}>Updated {formatRelative(ticket.updatedAt, now)}</span>
    </p>
  );
}
