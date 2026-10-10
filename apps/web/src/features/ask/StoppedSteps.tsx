import type { Run } from '@tracker/shared';
import { AnswerSteps } from './AnswerSteps';
import { ClaudeFrom } from './ClaudeFrom';
import styles from './ChatScreen.module.css';
import { STOPPED_STEPS_LABEL } from './copy';

// A question that stopped adds no answer, so what Claude did before it stopped folds here, where
// the working message was, and the footer says why it stopped.
export function StoppedSteps({ run }: { run: Run }) {
  return (
    <li className={`${styles.item} rise`}>
      <article className={styles.claude} aria-label={STOPPED_STEPS_LABEL}>
        <ClaudeFrom />
        <AnswerSteps runId={run.id} count={run.stepCount} />
      </article>
    </li>
  );
}
