import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { useIsPhone } from '../../../lib/media';
import { useNow } from '../../../lib/useNow';
import { ClaudeSection } from './ClaudeSection';
import { DeleteTicket } from './DeleteTicket';
import { DetailsCard } from './DetailsCard';
import { InfoCard } from './InfoCard';
import styles from './SidePanel.module.css';

export interface TicketSidePanelProps {
  detail: TicketDetail;
  className?: string | undefined;
}

export function TicketSidePanel({ detail, className }: TicketSidePanelProps) {
  const isPhone = useIsPhone();
  const now = useNow();
  return (
    <aside aria-label="Ticket details" className={clsx(styles.panel, className)}>
      {!isPhone && <ClaudeSection detail={detail} now={now} />}
      <DetailsCard detail={detail} />
      <InfoCard detail={detail} now={now} />
      <DeleteTicket ticketKey={detail.ticket.key} />
    </aside>
  );
}
