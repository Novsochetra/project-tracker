import type { BatchTicket } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Icon, ListRow } from '../../components';
import { useIsOpening, type Route } from '../../navigation';
import { STATE_LABELS } from '../ask/runAllCard';
import { stepIcon } from '../steps/stepIcon';
import { latestStep, stepLine } from '../steps/stepLine';
import { useStepRows } from '../steps/useStepRows';
import styles from './BatchTickets.module.css';
import { ticketRoute } from './batchTicketText';

// No live region: a sub agent takes several steps a second, and each one read out would drown the list.
function LatestStep({ runId }: { runId: string }) {
  const latest = latestStep(useStepRows(runId));
  if (!latest) return null;
  return (
    <span key={latest.seq} className={clsx(styles.step, 'fade-in')}>
      <Icon icon={stepIcon(latest)} size={14} className={styles.stepIcon} />
      <span className={styles.stepText}>{stepLine(latest)}</span>
    </span>
  );
}

interface BatchTicketRowProps {
  projectKey: string;
  ticket: BatchTicket;
  onOpen: (route: Route) => void;
}

export function BatchTicketRow({ projectKey, ticket, onOpen }: BatchTicketRowProps) {
  const route = ticketRoute(projectKey, ticket.ticketKey);
  const opening = useIsOpening(route);
  return (
    <ListRow
      className={styles.ticket}
      data-opening={opening || undefined}
      onClick={() => onOpen(route)}
    >
      <span className={styles.text}>
        <span className={styles.title}>
          <span className={styles.key}>{ticket.ticketKey}</span> {ticket.ticketTitle}
        </span>
        {ticket.state === 'running' && <LatestStep runId={ticket.runId} />}
      </span>{' '}
      <span className={clsx(styles.state, styles[ticket.state])}>{STATE_LABELS[ticket.state]}</span>
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}
