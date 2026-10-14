import type { ActivityBatch } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { errorMessage } from '../../api';
import { Button, Icon, ListRow, useToast } from '../../components';
import { useIsOpening, type Route } from '../../navigation';
import rowStyles from './ActivityRow.module.css';
import { batchProgressText, failedKeysText, isBatchActive } from './batchText';
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
  const route: Route = { name: 'project', key: batch.projectKey };
  const opening = useIsOpening(route);
  const failed = failedKeysText(batch);
  return (
    <div className={styles.batch}>
      <ListRow
        className={styles.open}
        data-opening={opening || undefined}
        onClick={() => onOpen(route)}
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
        <Icon icon={ChevronRight} size={20} className={rowStyles.chevron} />
      </ListRow>
      {isBatchActive(batch) && <StopButton runId={batch.runId} projectName={batch.projectName} />}
    </div>
  );
}
