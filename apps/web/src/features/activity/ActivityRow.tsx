import type { ActivityRun } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Icon, ListRow } from '../../components';
import { parseTicketKey } from '@tracker/shared';
import { useIsOpening, type Route } from '../../navigation';
import styles from './ActivityRow.module.css';
import { runTimeText, STATE_LABEL } from './runTime';

interface ActivityRowProps {
  run: ActivityRun;
  now: number;
  onOpen: (route: Route) => void;
}

// The ticket screen holds the run's chat with Claude, so a row opens the ticket.
const ticketRoute = (run: ActivityRun): Route => ({
  name: 'ticket',
  key: run.projectKey,
  num: parseTicketKey(run.ticketKey)?.num ?? 0,
});

export function ActivityRow({ run, now, onOpen }: ActivityRowProps) {
  const route = ticketRoute(run);
  const opening = useIsOpening(route);
  return (
    <ListRow data-opening={opening || undefined} onClick={() => onOpen(route)}>
      <span className={styles.text}>
        <span className={styles.project}>{run.projectName}</span>{' '}
        <span className={styles.ticket}>
          <span className={styles.key}>{run.ticketKey}</span> {run.ticketTitle}
        </span>
      </span>{' '}
      <span className={styles.meta}>
        <span className={clsx(styles.state, styles[run.state])}>{STATE_LABEL[run.state]}</span>{' '}
        <span className={styles.time}>{runTimeText(run, now)}</span>
      </span>
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}
