import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { useNow } from '../../../lib/useNow';
import { DeleteTicket } from './DeleteTicket';
import { DetailsCard } from './DetailsCard';
import { InfoCard } from './InfoCard';
import styles from './SidePanel.module.css';

export interface TicketSidePanelProps {
  detail: TicketDetail;
  className?: string | undefined;
}

// Desktop only: phones show the details as chips under the title and the rest after the activity.
export function TicketSidePanel({ detail, className }: TicketSidePanelProps) {
  const now = useNow();

  return (
    <aside aria-label="Ticket details" className={clsx(styles.panel, className)}>
      <DetailsCard detail={detail} />
      <InfoCard detail={detail} now={now} />
      <DeleteTicket ticketKey={detail.ticket.key} />
    </aside>
  );
}
