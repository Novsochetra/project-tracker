import type { RunActivity } from '@tracker/shared';
import { Activity as ActivityIcon } from 'lucide-react';
import { errorMessage } from '../../api';
import { useRunActivity } from '../../api/hooks/runActivity';
import { Button, EmptyState, ListCard } from '../../components';
import { PullToRefresh } from '../../gestures';
import { useNow } from '../../lib/useNow';
import { LargeTitle, NavBar, useNavigation, useScreen } from '../../navigation';
import { AccountButton } from '../account';
import styles from './ActivityScreen.module.css';
import { ActivityRow } from './ActivityRow';
import { BatchRow } from './BatchRow';
import { HomeTabs } from './HomeTabs';
import { limitText } from './runTime';

const CLOCK_MS = 30_000;

function ActivityList({ activity }: { activity: RunActivity }) {
  const { push } = useNavigation();
  const now = useNow(CLOCK_MS);
  const { runs, batches } = activity;
  if (runs.length === 0 && batches.length === 0) {
    return (
      <EmptyState
        bordered
        icon={ActivityIcon}
        title="Nothing running"
        text="Runs from all your projects show here while Claude works on them."
      />
    );
  }
  return (
    <>
      {batches.length > 0 && (
        <ListCard aria-label="Run all batches">
          {batches.map((batch) => (
            <BatchRow key={batch.runId} batch={batch} now={now} onOpen={push} />
          ))}
        </ListCard>
      )}
      {runs.length > 0 && (
        <ListCard aria-label="Active runs">
          {runs.map((run) => (
            <ActivityRow key={run.runId} run={run} now={now} onOpen={push} />
          ))}
        </ListCard>
      )}
    </>
  );
}

export function ActivityScreen() {
  const query = useRunActivity();
  const { scrollRef } = useScreen();
  return (
    <>
      <NavBar title="Activity" left={<AccountButton />} />
      <PullToRefresh onRefresh={() => query.refetch()} scrollRef={scrollRef}>
        <div className={styles.page}>
          <div className={styles.content}>
            <LargeTitle>Activity</LargeTitle>
            <HomeTabs />
            {query.data && (
              <>
                <p className={styles.summary} aria-live="polite">
                  {limitText(query.data.runningCount, query.data.limit)}
                </p>
                <ActivityList activity={query.data} />
              </>
            )}
            {!query.data && query.error && (
              <div className={styles.loadError}>
                <p role="alert">{errorMessage(query.error)}</p>
                <Button onClick={() => void query.refetch()}>Try again</Button>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </>
  );
}
