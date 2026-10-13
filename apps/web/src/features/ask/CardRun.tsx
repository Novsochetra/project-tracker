import type { Run, Runner } from '@tracker/shared';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { useRunCardTicket } from '../../api/hooks/chats';
import { useCancelRun, useTicketRuns } from '../../api/hooks/runs';
import { Button, Spinner, useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useNow } from '../../lib/useNow';
import { sentText, shownRun } from '../claude/runs';
import { UsageLine } from '../claude/UsageLine';
import styles from './TicketCard.module.css';

export interface CardRunProps {
  ticketKey: string;
  helper: Runner | null;
}

// Cancel and Run take turns in one spot, so a double tap's second tap must not press the other.
const holdAfterTap = (event: MouseEvent<HTMLButtonElement>) => {
  if (event.detail !== 0) holdPresses(event.currentTarget);
};

function WorkingRun({ run, text }: { run: Run; text: string }) {
  const cancel = useCancelRun();
  const toast = useToast();
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    holdAfterTap(event);
    cancel.mutate(run, {
      onError: (error) => toast.show(errorMessage(error), { kind: 'error' }),
    });
  };
  return (
    <div className={styles.run}>
      <p className={styles.runLine}>
        <span aria-hidden="true" className={styles.spinner}>
          <Spinner />
        </span>
        {text}
      </p>
      <Button size="lg" className={styles.action} disabled={cancel.isPending} onClick={onClick}>
        Cancel
      </Button>
    </div>
  );
}

export function CardRun({ ticketKey, helper }: CardRunProps) {
  const runs = useTicketRuns(ticketKey);
  const shown = shownRun(runs.data, useNow());
  const start = useRunCardTicket();
  const toast = useToast();
  if (shown?.state === 'working') return <WorkingRun run={shown.run} text={shown.text} />;
  const onRun = (event: MouseEvent<HTMLButtonElement>) => {
    if (!helper || start.isPending) return;
    holdAfterTap(event);
    start.mutate(
      { ticketKey, runnerId: helper.id },
      { onSuccess: () => toast.show(sentText(helper)) },
    );
  };
  return (
    <div className={styles.run}>
      {shown && <p className={styles.runLine}>{shown.text}</p>}
      {shown && <UsageLine usage={shown.run.usage} />}
      {start.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(start.error)}
        </p>
      )}
      {helper && (
        <Button
          variant="primary"
          size="lg"
          icon={Play}
          aria-label={`Run ${ticketKey} in Claude Code`}
          className={styles.action}
          disabled={start.isPending}
          onClick={onRun}
        >
          Run
        </Button>
      )}
    </div>
  );
}
