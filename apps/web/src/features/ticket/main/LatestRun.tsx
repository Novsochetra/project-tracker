import type { Run } from '@tracker/shared';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../../api';
import { useCancelRun, useTicketRuns } from '../../../api/hooks/runs';
import { useSheets } from '../../../app/sheets/context';
import { AgentAvatar, Button, useToast } from '../../../components';
import { holdPresses } from '../../../lib/holdPresses';
import { useNow } from '../../../lib/useNow';
import { runTime, shownRun } from '../../claude/runs';
import { UsageLine } from '../../claude/UsageLine';
import { WAITING_TEXT } from '../../requests/copy';
import { RequestCards } from '../../requests/RequestCards';
import { useRequests } from '../../requests/useRequests';
import { ActivityCard } from '../activity/ActivityCard';
import cardStyles from '../activity/ActivityCard.module.css';
import { PhoneFold } from '../activity/PhoneFold';
import { TimeAgo } from '../activity/TimeAgo';
import { promptSheet } from '../ticketSheets';
import styles from './LatestReview.module.css';
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
        <UsageLine usage={shown.run.usage} />
        <RunStepsLine run={shown.run} ticketKey={ticketKey} />
        <RequestCards ref={cardsRef} requests={requests.shown} now={requests.now} />
        {shown.state === 'working' && <CancelButton run={shown.run} onCancelled={onCancelled} />}
        {shown.state === 'stopped' && <TryAgainButton ticketKey={ticketKey} />}
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
