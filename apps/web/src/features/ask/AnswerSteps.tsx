import { useId, useState } from 'react';
import { useRunSteps } from '../../api/hooks/runSteps';
import { ShowMoreButton } from '../../components';
import { stepsLabel } from '../steps/stepCopy';
import { StepsPanel } from '../steps/StepsPanel';
import styles from './ChatScreen.module.css';

export interface AnswerStepsProps {
  runId: string;
  count: number;
}

// Above the answer, where the working message showed them: they came before its words.
export function AnswerSteps({ runId, count }: AnswerStepsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const steps = useRunSteps(runId, { enabled: open });
  const label = stepsLabel(count);
  return (
    <div className={styles.answerSteps}>
      <ShowMoreButton
        expanded={open}
        controls={open ? id : undefined}
        moreLabel={label}
        lessLabel={label}
        className={styles.stepsToggle}
        onClick={() => setOpen(!open)}
      />
      {open && <StepsPanel id={id} steps={steps} variant="history" />}
    </div>
  );
}
