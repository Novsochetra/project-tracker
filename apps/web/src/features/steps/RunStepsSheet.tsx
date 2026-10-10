import { useRef } from 'react';
import { useTicketRuns } from '../../api/hooks/runs';
import { useRunSteps } from '../../api/hooks/runSteps';
import { lastSeq } from '../../api/runSteps';
import { isWorking } from '../../api/workingRun';
import type { SheetProps } from '../../app/sheets/types';
import { Spinner } from '../../components';
import { useIsPhone } from '../../lib/media';
import { Sheet, SheetTextButton } from '../../overlays';
import { workingText } from '../claude/runs';
import { stepsLabel, STEPS_LIST_LABEL } from './stepCopy';
import styles from './RunStepsSheet.module.css';
import { StepsPanel } from './StepsPanel';
import { useFollowEnd } from './useFollowEnd';

export interface RunStepsSheetProps extends SheetProps {
  runId: string;
  ticketKey: string;
}

export function RunStepsSheet({ open, onClose, runId, ticketKey }: RunStepsSheetProps) {
  const steps = useRunSteps(runId, { enabled: open });
  const run = useTicketRuns(ticketKey).data?.find(({ id }) => id === runId);
  const seq = lastSeq(steps.data ?? []);
  const count = Math.max(run?.stepCount ?? 0, seq);
  const listRef = useRef<HTMLDivElement>(null);
  useFollowEnd(listRef, seq);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={STEPS_LIST_LABEL}
      title="Steps"
      subtitle={count > 0 ? `${ticketKey} · ${stepsLabel(count)}` : ticketKey}
      size="report"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      {/* On desktop the sheet grows with its content, so a long run scrolls in here instead. */}
      <div className={useIsPhone() ? styles.body : `${styles.body} ${styles.scrolls}`}>
        <div ref={listRef}>
          <StepsPanel steps={steps} variant="full" />
        </div>
        {run && isWorking(run) && (
          <p className={styles.working}>
            <Spinner size={14} label="Working" />
            {workingText(run)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
