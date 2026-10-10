import type { RunStep } from '@tracker/shared';
import { useMemo } from 'react';
import type { TrackerQuery } from '../../api/types';
import { Button, Spinner } from '../../components';
import { notKeptText, STEPS_FAILED_TEXT } from './stepCopy';
import { StepList } from './StepList';
import { stepRows, withoutAnswer } from './stepRows';
import styles from './Steps.module.css';
import type { StepVariant } from './stepVariant';
import { visibleSteps } from './visibleSteps';

export interface StepsPanelProps {
  id?: string | undefined;
  steps: TrackerQuery<RunStep[]>;
  variant: StepVariant;
  answer?: string | undefined;
}

export function StepsPanel({ id, steps, variant, answer }: StepsPanelProps) {
  const rows = useMemo(() => stepRows(steps.data ?? []), [steps.data]);
  if (steps.data) {
    const { notKept } = visibleSteps(rows, true);
    const shown = answer === undefined ? rows : withoutAnswer(rows, answer);
    return (
      <div id={id} className={`${styles.steps} fade-in`}>
        {notKept > 0 && <p className={styles.note}>{notKeptText(notKept)}</p>}
        <StepList rows={shown} variant={variant} />
      </div>
    );
  }
  if (steps.error) {
    return (
      <p id={id} className={styles.failed}>
        {STEPS_FAILED_TEXT}{' '}
        <Button
          variant="text"
          size="sm"
          className={styles.retry}
          onClick={() => void steps.refetch()}
        >
          Try again
        </Button>
      </p>
    );
  }
  return (
    <div id={id} className={`${styles.loading} quiet-in`}>
      <Spinner size={14} label="Loading the steps" />
    </div>
  );
}
