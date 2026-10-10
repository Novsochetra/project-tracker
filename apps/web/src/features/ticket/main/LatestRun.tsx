import type { Run } from '@tracker/shared';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../../api';
import { useCancelRun, useTicketRuns } from '../../../api/hooks/runs';
import { useSheets } from '../../../app/sheets/context';
import { AgentAvatar, Button, useToast } from '../../../components';
import { holdPresses } from '../../../lib/holdPresses';
import { useNow } from '../../../lib/useNow';
import { runTime, shownRun } from '../../claude/runs';
import { ActivityCard } from '../activity/ActivityCard';
import cardStyles from '../activity/ActivityCard.module.css';
import { PhoneFold } from '../activity/PhoneFold';
import { TimeAgo } from '../activity/TimeAgo';
import { promptSheet } from '../ticketSheets';
import styles from './LatestReview.module.css';

export interface LatestRunProps {
  ticketKey: string;
  onCancelled: () => void;
}

export function LatestRun({ ticketKey, onCancelled }: LatestRunProps) {
  const runs = useTicketRuns(ticketKey);
  const now = useNow();
  const shown = shownRun(runs.data, now);
  if (!shown) return null;
  return (
    <section aria-label="Claude Code run" className={styles.latest}>
      <ActivityCard
        avatar={<AgentAvatar />}
        title="Claude Code"
        meta={<TimeAgo at={runTime(shown.run)} now={now} />}
      >
        <PhoneFold>
          <p className={cardStyles.body}>{shown.text}</p>
        </PhoneFold>
        {shown.state === 'working' ? (
          <CancelButton run={shown.run} onCancelled={onCancelled} />
        ) : (
          <TryAgainButton ticketKey={ticketKey} />
        )}
      </ActivityCard>
    </section>
  );
}

function CancelButton({ run, onCancelled }: { run: Run; onCancelled: () => void }) {
  const cancel = useCancelRun();
  const toast = useToast();
  // The card leaves once the run is cancelled, and what moves up into its place must not take the
  // second tap of a double tap.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    cancel.mutate(run, {
      onSuccess: onCancelled,
      onError: (error) => toast.show(errorMessage(error), { kind: 'error' }),
    });
  };
  return (
    <Button size="lg" className={styles.action} disabled={cancel.isPending} onClick={onClick}>
      Cancel
    </Button>
  );
}

function TryAgainButton({ ticketKey }: { ticketKey: string }) {
  const sheets = useSheets();
  return (
    <Button size="lg" className={styles.action} onClick={() => sheets.open(promptSheet(ticketKey))}>
      Try again
    </Button>
  );
}
