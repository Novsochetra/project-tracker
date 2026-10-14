import clsx from 'clsx';
import { errorMessage } from '../../api';
import { useRunBatch } from '../../api/hooks/runBatch';
import { batchCountsText, batchEndText } from './runAllCard';
import styles from './RunAllCard.module.css';
import { RunAllHead, RunAllTickets } from './RunAllTickets';

export function RunAllProgress({ runId }: { runId: string }) {
  const batch = useRunBatch(runId);
  const shown = batch.data;
  const end = shown ? batchEndText(shown.status) : null;
  return (
    <section className={styles.card} aria-label="Run all progress">
      <RunAllHead />
      {shown && (
        <>
          <p className={styles.counts} aria-live="polite">
            {batchCountsText(shown.tickets)}
          </p>
          <RunAllTickets tickets={shown.tickets} />
          {end && <p className={styles.end}>{end}</p>}
        </>
      )}
      {batch.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(batch.error)}
        </p>
      )}
    </section>
  );
}
