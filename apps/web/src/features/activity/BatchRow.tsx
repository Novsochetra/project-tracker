import type { ActivityBatch } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '../../api';
import { Button, Icon, ListRow, useToast } from '../../components';
import type { Route } from '../../navigation';
import rowStyles from './ActivityRow.module.css';
import { batchProgressText, failedKeysText, isBatchActive } from './batchText';
import { BatchTickets } from './BatchTickets';
import styles from './BatchRow.module.css';
import { runTimeText, STATE_LABEL } from './runTime';
import { useStopBatch } from './useStopBatch';

interface BatchRowProps {
  batch: ActivityBatch;
  now: number;
  onOpen: (route: Route) => void;
}

function StopButton({ runId, projectName }: { runId: string; projectName: string }) {
  const stop = useStopBatch();
  const toast = useToast();
  const onClick = () =>
    stop.mutate(runId, { onError: (error) => toast.show(errorMessage(error), { kind: 'error' }) });
  return (
    <Button
      size="sm"
      className={styles.stop}
      aria-label={`Stop Run all for ${projectName}`}
      disabled={stop.isPending}
      onClick={onClick}
    >
      Stop
    </Button>
  );
}

export function BatchRow({ batch, now, onOpen }: BatchRowProps) {
  const [open, setOpen] = useState(false);
  const ticketsId = useId();
  const failed = failedKeysText(batch);
  return (
    <div>
      <div className={styles.batch}>
        <ListRow
          className={styles.open}
          aria-expanded={open}
          aria-controls={open ? ticketsId : undefined}
          onClick={() => setOpen(!open)}
        >
          <span className={rowStyles.text}>
            <span className={rowStyles.project}>{batch.projectName}</span>{' '}
            <span className={rowStyles.ticket}>
              Run all <span className={rowStyles.key}>{batchProgressText(batch)}</span>
            </span>
            {failed && <span className={styles.failedKeys}> {failed}</span>}
          </span>{' '}
          <span className={rowStyles.meta}>
            <span className={clsx(rowStyles.state, rowStyles[batch.state])}>
              {STATE_LABEL[batch.state]}
            </span>{' '}
            <span className={rowStyles.time}>{runTimeText(batch, now)}</span>
          </span>
          <Icon
            icon={ChevronRight}
            size={20}
            className={clsx(rowStyles.chevron, styles.turn, open && styles.turned)}
          />
        </ListRow>
        {isBatchActive(batch) && <StopButton runId={batch.runId} projectName={batch.projectName} />}
      </div>
      {open && <BatchTickets id={ticketsId} batch={batch} onOpen={onOpen} />}
    </div>
  );
}
