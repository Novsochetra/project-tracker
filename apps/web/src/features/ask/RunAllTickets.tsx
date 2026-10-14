import type { BatchTicketState } from '@tracker/shared';
import clsx from 'clsx';
import { ListChecks } from 'lucide-react';
import { Icon } from '../../components';
import { RUN_ALL_TITLE, STATE_LABELS } from './runAllCard';
import styles from './RunAllCard.module.css';

export interface RunAllTicket {
  ticketKey: string;
  ticketTitle: string;
  state?: BatchTicketState;
}

export function RunAllHead() {
  return (
    <div className={styles.head}>
      <Icon icon={ListChecks} size={14} />
      {RUN_ALL_TITLE}
    </div>
  );
}

export function RunAllTickets({ tickets }: { tickets: readonly RunAllTicket[] }) {
  if (tickets.length === 0) return null;
  return (
    <ul className={styles.tickets} aria-label="Tickets">
      {tickets.map(({ ticketKey, ticketTitle, state }) => (
        <li key={ticketKey} className={styles.ticket}>
          <span className={styles.key}>{ticketKey}</span>
          <span className={styles.ticketTitle}>{ticketTitle}</span>
          {state && (
            <span className={clsx(styles.state, styles[state])}>{STATE_LABELS[state]}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
