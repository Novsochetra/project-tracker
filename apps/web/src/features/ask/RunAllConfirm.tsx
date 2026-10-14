import type { Runner } from '@tracker/shared';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { errorMessage } from '../../api';
import { useRunAllFromCard, useRunAllPreview } from '../../api/hooks/runBatch';
import { Button, useToast } from '../../components';
import { rememberHelper } from '../claude/lastHelper';
import { runAllToast } from '../project/runAll';
import { limitText, NO_HELPER_HINT, NOTHING_TO_RUN, skippedLines } from './runAllCard';
import styles from './RunAllCard.module.css';
import { RunAllHead, RunAllTickets } from './RunAllTickets';

export interface RunAllConfirmProps {
  chatId: string;
  projectKey: string;
  messageId: string;
  limit: number | null;
  helper: Runner | null;
}

export function RunAllConfirm({
  chatId,
  projectKey,
  messageId,
  limit,
  helper,
}: RunAllConfirmProps) {
  const preview = useRunAllPreview(projectKey);
  const start = useRunAllFromCard();
  const { show } = useToast();
  const shown = preview.data;
  const empty = shown?.tickets.length === 0;
  const confirm = () => {
    if (!shown || !helper || start.isPending) return;
    start.mutate(
      {
        chatId,
        projectKey,
        messageId,
        input: {
          runnerId: helper.id,
          maxParallel: limit ?? undefined,
          ticketKeys: shown.tickets.map(({ ticketKey }) => ticketKey),
        },
      },
      {
        onSuccess: (result) => {
          rememberHelper(helper.id);
          show(runAllToast(result));
        },
        onError: (error) => show(errorMessage(error), { kind: 'error' }),
      },
    );
  };
  return (
    <section className={styles.card} aria-label="Run all card">
      <RunAllHead />
      <p className={styles.limit}>{limitText(limit, shown)}</p>
      {shown && <RunAllTickets tickets={shown.tickets} />}
      {empty && <p className={styles.note}>{NOTHING_TO_RUN}</p>}
      {shown &&
        skippedLines(shown).map((line) => (
          <p key={line} className={styles.note}>
            {line}
          </p>
        ))}
      {preview.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(preview.error)}
        </p>
      )}
      {!helper && <p className={styles.note}>{NO_HELPER_HINT}</p>}
      <Button
        variant="primary"
        size="lg"
        icon={Play}
        className={styles.action}
        // The chat refreshes after a start to show progress; Confirm stays off until it does.
        disabled={!shown || empty || !helper || start.isPending || Boolean(start.data?.runId)}
        onClick={confirm}
      >
        Confirm
      </Button>
    </section>
  );
}
