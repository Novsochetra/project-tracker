import { PRIORITY_LABELS, type Runner, type TicketCard } from '@tracker/shared';
import { Ticket } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTicket } from '../../api';
import { Icon, PriorityBars } from '../../components';
import { routePath, useNavigation } from '../../navigation';
import { CardRun } from './CardRun';
import styles from './TicketCard.module.css';
import { ticketRoute } from './ticketChat';

export interface CreatedCardProps {
  ticketKey: string;
  card: TicketCard;
  helper: Runner | null;
}

// The ticket as the tracker has it: the person may have changed the card before Create.
export function CreatedCard({ ticketKey, card, helper }: CreatedCardProps) {
  const ticket = useTicket(ticketKey).data?.ticket;
  const { push } = useNavigation();
  const route = ticketRoute(ticketKey);
  const priority = ticket?.priority ?? card.priority;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!route || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    push(route);
  };
  return (
    <section className={styles.card} aria-label={`Ticket ${ticketKey}`}>
      <div className={styles.head}>
        <Icon icon={Ticket} size={14} />
        <a className={styles.key} href={route ? routePath(route) : undefined} onClick={open}>
          {ticketKey}
        </a>
        <PriorityBars priority={priority} />
        <span className="visually-hidden">Priority: {PRIORITY_LABELS[priority]}</span>
      </div>
      <p className={styles.createdTitle}>{ticket?.title ?? card.title}</p>
      <CardRun ticketKey={ticketKey} helper={helper} />
    </section>
  );
}
