import type { Run } from '@tracker/shared';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../../api';
import { useCancelRun, useTicketRuns } from '../../../api/hooks/runs';
import { useSheets } from '../../../app/sheets/context';
import { AgentAvatar, Button, useToast } from '../../../components';
import { holdPresses } from '../../../lib/holdPresses';
import { useNow } from '../../../lib/useNow';
import { runTime, shownRun, type ShownRun } from '../../claude/runs';
import { WAITING_TEXT } from '../../requests/copy';
import { RequestCards } from '../../requests/RequestCards';
import { useRequests } from '../../requests/useRequests';
import { ActivityCard } from '../activity/ActivityCard';
import cardStyles from '../activity/ActivityCard.module.css';
import { PhoneFold } from '../activity/PhoneFold';
import { TimeAgo } from '../activity/TimeAgo';
import { promptSheet } from '../ticketSheets';
import styles from './LatestReview.module.css';
import runStyles from './LatestRun.module.css';
import { RunStepsLine } from './RunStepsLine';
import { useRevealWaiting } from './useRevealWaiting';

export interface LatestRunProps {
  ticketKey: string;
  onCancelled: () => void;
}

export function LatestRun({ ticketKey, onCancelled }: LatestRunProps) {
  const runs = useTicketRuns(ticketKey);
  const now = useNow();
  const shown = shownRun(runs.data, now);
  const requests = useRequests(shown?.run.id ?? null);
  const cardsRef = useRevealWaiting(requests);
  if (!shown) return null;
  return (
    <section aria-label="Claude Code run" className={styles.latest}>
      <ActivityCard
        avatar={<AgentAvatar />}
        title="Claude Code"
        meta={<TimeAgo at={runTime(shown.run)} now={now} />}
      >
        <PhoneFold>
          <p className={cardStyles.body}>{requests.waiting ? WAITING_TEXT : shown.text}</p>
        </PhoneFold>
        <RunStepsLine run={shown.run} ticketKey={ticketKey} />
        <RequestCards ref={cardsRef} requests={requests.shown} now={requests.now} />
        <RunAction shown={shown} ticketKey={ticketKey} onCancelled={onCancelled} />
      </ActivityCard>
    </section>
  );
}

interface RunActionProps extends LatestRunProps {
  shown: ShownRun;
}

// Only the whole batch can be stopped, so a ticket in one has no Cancel of its own.
function RunAction({ shown, ticketKey, onCancelled }: RunActionProps) {
  if (shown.state !== 'working') return <TryAgainButton ticketKey={ticketKey} />;
  if (shown.run.batchId !== null) {
    return <p className={runStyles.batchNote}>Part of a Run all batch. Stop it from Activity.</p>;
  }
  return <CancelButton run={shown.run} onCancelled={onCancelled} />;
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
