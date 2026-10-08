import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import type { Ref } from 'react';
import { useIsPhone } from '../../../lib/media';
import { useNow } from '../../../lib/useNow';
import { ClaudeSection } from './ClaudeSection';
import { DeleteTicket } from './DeleteTicket';
import { DetailsCard } from './DetailsCard';
import { InfoCard } from './InfoCard';
import styles from './SidePanel.module.css';

export interface TicketSidePanelProps {
  detail: TicketDetail;
  offersDone: boolean;
  className?: string | undefined;
  ref?: Ref<HTMLElement>;
}

export function TicketSidePanel({ detail, offersDone, className, ref }: TicketSidePanelProps) {
  const isPhone = useIsPhone();
  const now = useNow();
  return (
    <aside ref={ref} aria-label="Ticket details" className={clsx(styles.panel, className)}>
      {!isPhone && <ClaudeSection detail={detail} now={now} offersDone={offersDone} />}
      <DetailsCard detail={detail} />
      <InfoCard detail={detail} now={now} />
      <DeleteTicket ticketKey={detail.ticket.key} />
    </aside>
  );
}
