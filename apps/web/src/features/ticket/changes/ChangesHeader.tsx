import type { DiffFile, ReviewVerdict, TicketChanges, TicketDetail } from '@tracker/shared';
import { Check, RotateCcw } from 'lucide-react';
import { errorMessage } from '../../../api';
import { useChangesVerdict } from '../../../api/hooks/changes';
import { Button, useToast, VerdictChip } from '../../../components';
import { viewedLabel } from '../../changes/copy';
import { viewedCount } from '../../changes/diffLines';
import { APPROVED_TOAST, ASKED_TOAST } from './copy';
import styles from './TicketChanges.module.css';

export interface ChangesHeaderProps {
  detail: TicketDetail;
  changes: TicketChanges;
  files: readonly DiffFile[];
}

const TOASTS: Record<ReviewVerdict, string> = {
  approved: APPROVED_TOAST,
  changes_requested: ASKED_TOAST,
};

export function ChangesHeader({ detail, changes, files }: ChangesHeaderProps) {
  const verdict = useChangesVerdict();
  const { show } = useToast();
  const send = (choice: ReviewVerdict) =>
    verdict.mutate(
      {
        ticketKey: detail.ticket.key,
        projectKey: detail.project.key,
        runId: changes.runId,
        verdict: choice,
      },
      {
        onSuccess: () => show(TOASTS[choice]),
        onError: (error) => show(errorMessage(error), { kind: 'error' }),
      },
    );

  return (
    <div className={styles.header}>
      <div className={styles.summary}>
        {files.length > 0 && (
          <span className={styles.count}>
            {viewedLabel(viewedCount(files, changes.viewed), files.length)}
          </span>
        )}
        {changes.verdict && <VerdictChip verdict={changes.verdict} />}
      </div>
      <div className={styles.actions}>
        <Button
          icon={RotateCcw}
          disabled={verdict.isPending}
          onClick={() => send('changes_requested')}
        >
          Ask for changes
        </Button>
        <Button
          variant="primary"
          icon={Check}
          disabled={verdict.isPending}
          onClick={() => send('approved')}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
