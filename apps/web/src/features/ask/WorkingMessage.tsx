import { LiveSteps } from '../steps/LiveSteps';
import type { StepRow } from '../steps/stepRows';
import { ClaudeFrom } from './ClaudeFrom';
import styles from './ChatScreen.module.css';
import { WORKING_LABEL } from './copy';

// Steps are not announced one by one, since Claude can take several a second; the list reads in
// order when visited.
export function WorkingMessage({ rows }: { rows: StepRow[] }) {
  return (
    <li className={`${styles.item} rise`}>
      <article className={styles.claude} aria-label={WORKING_LABEL}>
        <ClaudeFrom />
        <LiveSteps rows={rows} />
      </article>
    </li>
  );
}
