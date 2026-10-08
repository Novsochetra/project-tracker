import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { useNow } from '../../../lib/useNow';
import { DeleteTicket } from './DeleteTicket';
import { InfoLine } from './InfoLine';
import styles from './SidePanel.module.css';

// On phones what the side panel kept under Details goes after the comment box (§1.7).
export function TicketFooter({ detail, className }: { detail: TicketDetail; className?: string }) {
  const now = useNow();
  return (
    <div className={clsx(styles.footer, className)}>
      <InfoLine detail={detail} now={now} />
      <DeleteTicket ticketKey={detail.ticket.key} />
    </div>
  );
}
