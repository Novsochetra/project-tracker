import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useRunSteps } from '../../api/hooks/runSteps';
import { ShowMoreButton } from '../../components';
import { stepsLabel } from '../steps/stepCopy';
import { StepsPanel } from '../steps/StepsPanel';
import styles from './ChatScreen.module.css';
import { takeStepsFocus } from './stepsFocus';

export interface AnswerStepsProps {
  runId: string;
  count: number;
  // None for a question that stopped before Claude answered.
  answer?: string | undefined;
}

// Above the answer, where the working message showed them: they came before its words.
export function AnswerSteps({ runId, count, answer }: AnswerStepsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const steps = useRunSteps(runId, { enabled: open });
  const label = stepsLabel(count);
  useLayoutEffect(() => {
    if (takeStepsFocus(runId)) ref.current?.querySelector('button')?.focus();
  }, [runId]);
  return (
    <div ref={ref} className={styles.answerSteps}>
      <ShowMoreButton
        expanded={open}
        controls={open ? id : undefined}
        moreLabel={label}
        lessLabel={label}
        className={styles.stepsToggle}
        onClick={() => setOpen(!open)}
      />
      {open && <StepsPanel id={id} steps={steps} variant="history" answer={answer} />}
    </div>
  );
}
