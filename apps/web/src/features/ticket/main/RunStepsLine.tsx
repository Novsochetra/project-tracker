import type { Run } from '@tracker/shared';
import { ChevronRight } from 'lucide-react';
import { lastSeq } from '../../../api/runSteps';
import { useSheets } from '../../../app/sheets/context';
import { Icon } from '../../../components';
import { stepsLabel } from '../../steps/stepCopy';
import { stepIcon } from '../../steps/stepIcon';
import { latestStep, stepLine } from '../../steps/stepLine';
import { useStepRows } from '../../steps/useStepRows';
import { stepsSheet } from '../ticketSheets';
import styles from './RunStepsLine.module.css';

export interface RunStepsLineProps {
  run: Run;
  ticketKey: string;
}

// No live region: Claude can take several steps a second, and each one read out would drown the page.
export function RunStepsLine({ run, ticketKey }: RunStepsLineProps) {
  const sheets = useSheets();
  const rows = useStepRows(run.id);
  const latest = latestStep(rows);
  if (!latest) return null;
  const line = stepLine(latest);
  const count = stepsLabel(Math.max(run.stepCount, lastSeq(rows)));
  return (
    <button
      type="button"
      className={`${styles.line} ring-inside`}
      aria-label={`Latest step: ${line}, ${count}`}
      onClick={() => sheets.open(stepsSheet(run.id, ticketKey))}
    >
      <span key={latest.seq} className={`${styles.latest} fade-in`}>
        <Icon icon={stepIcon(latest)} size={14} className={styles.icon} />
        <span className={styles.text}>{line}</span>
      </span>
      <span className={styles.count}>{count}</span>
      <Icon icon={ChevronRight} size={14} className={styles.chevron} />
    </button>
  );
}
