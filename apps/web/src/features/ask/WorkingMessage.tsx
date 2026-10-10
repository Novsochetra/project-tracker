import { useLayoutEffect, useRef } from 'react';
import { LiveSteps } from '../steps/LiveSteps';
import type { StepRow } from '../steps/stepRows';
import { ClaudeFrom } from './ClaudeFrom';
import styles from './ChatScreen.module.css';
import { WORKING_LABEL } from './copy';
import { handStepsFocus } from './stepsFocus';

export interface WorkingMessageProps {
  runId: string;
  rows: StepRow[];
}

// Steps are not announced one by one, since Claude can take several a second; the list reads in
// order when visited.
export function WorkingMessage({ runId, rows }: WorkingMessageProps) {
  const ref = useRef<HTMLElement>(null);
  // A layout effect's cleanup runs while the message is still on the page, focus still inside it.
  useLayoutEffect(() => {
    const message = ref.current;
    return () => {
      if (message?.contains(document.activeElement)) handStepsFocus(runId);
    };
  }, [runId]);
  return (
    <li className={`${styles.item} rise`}>
      <article ref={ref} className={styles.claude} aria-label={WORKING_LABEL}>
        <ClaudeFrom />
        <LiveSteps rows={rows} />
      </article>
    </li>
  );
}
