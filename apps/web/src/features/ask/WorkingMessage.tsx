import type { RunRequests } from '../requests/useRequests';
import { RequestCards } from '../requests/RequestCards';
import { LiveSteps } from '../steps/LiveSteps';
import type { StepRow } from '../steps/stepRows';
import { ClaudeFrom } from './ClaudeFrom';
import styles from './ChatScreen.module.css';
import { WORKING_LABEL } from './copy';

export interface WorkingMessageProps {
  rows: StepRow[];
  requests: RunRequests;
}

// Steps are not announced one by one, since Claude can take several a second; the list reads in
// order when visited. A request is, since it waits for the person (RequestCards).
export function WorkingMessage({ rows, requests }: WorkingMessageProps) {
  return (
    <li className={`${styles.item} rise`}>
      <article className={styles.claude} aria-label={WORKING_LABEL}>
        <ClaudeFrom />
        {rows.length > 0 && <LiveSteps rows={rows} />}
        <RequestCards requests={requests.shown} now={requests.now} />
      </article>
    </li>
  );
}
