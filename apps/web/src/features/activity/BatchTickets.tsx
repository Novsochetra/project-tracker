import type { ActivityBatch } from '@tracker/shared';
import { ChevronRight } from 'lucide-react';
import { errorMessage } from '../../api';
import { useRunBatch } from '../../api/hooks/runBatch';
import { Icon, ListRow } from '../../components';
import type { Route } from '../../navigation';
import { BatchTicketRow } from './BatchTicketRow';
import styles from './BatchTickets.module.css';
import { openProjectText, ticketsLabel } from './batchTicketText';

interface BatchTicketsProps {
  id: string;
  batch: ActivityBatch;
  onOpen: (route: Route) => void;
}

export function BatchTickets({ id, batch, onOpen }: BatchTicketsProps) {
  const query = useRunBatch(batch.runId);
  return (
    <div id={id} className={`${styles.tickets} fade-in`}>
      {query.data && (
        <ul className={styles.list} aria-label={ticketsLabel(batch.projectName)}>
          {query.data.tickets.map((ticket) => (
            <li key={ticket.runId}>
              <BatchTicketRow projectKey={batch.projectKey} ticket={ticket} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      {!query.data && query.error && (
        <p role="alert" className={styles.error}>
          {errorMessage(query.error)}
        </p>
      )}
      <ListRow
        className={styles.project}
        onClick={() => onOpen({ name: 'project', key: batch.projectKey })}
      >
        <span className={styles.projectText}>{openProjectText(batch.projectName)}</span>
        <Icon icon={ChevronRight} size={20} className={styles.chevron} />
      </ListRow>
    </div>
  );
}
