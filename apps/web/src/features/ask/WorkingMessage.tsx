import { useLayoutEffect, useRef } from 'react';
import { RequestCards } from '../requests/RequestCards';
import type { RunRequests } from '../requests/useRequests';
import { LiveSteps } from '../steps/LiveSteps';
import type { StepRow } from '../steps/stepRows';
import { latestTodos, withoutTodoSteps } from '../todos/latestTodos';
import { TodoList } from '../todos/TodoList';
import { ClaudeFrom } from './ClaudeFrom';
import styles from './ChatScreen.module.css';
import { WORKING_LABEL } from './copy';
import { handStepsFocus } from './stepsFocus';

export interface WorkingMessageProps {
  runId: string;
  rows: StepRow[];
  requests: RunRequests;
}

// Steps are not announced one by one, since Claude can take several a second; the list reads in
// order when visited. A request is, since it waits for the person (RequestCards).
export function WorkingMessage({ runId, rows, requests }: WorkingMessageProps) {
  const ref = useRef<HTMLElement>(null);
  // A layout effect's cleanup runs while the message is still on the page, focus still inside it.
  useLayoutEffect(() => {
    const message = ref.current;
    return () => {
      if (message?.contains(document.activeElement)) handStepsFocus(runId);
    };
  }, [runId]);
  const todos = latestTodos(rows);
  const listed = todos ? withoutTodoSteps(rows) : rows;
  return (
    <li className={`${styles.item} rise`}>
      <article ref={ref} className={styles.claude} aria-label={WORKING_LABEL}>
        <ClaudeFrom />
        {todos && <TodoList todos={todos} />}
        {listed.length > 0 && <LiveSteps rows={rows} hideTodos={todos !== null} />}
        <RequestCards requests={requests.shown} now={requests.now} />
      </article>
    </li>
  );
}
