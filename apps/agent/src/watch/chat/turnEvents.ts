import { isJson } from '@tracker/shared';

// Claude Code 2.1.299 writes session_state_changed only with CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS
// set. Its idle comes once background agents are done and their result is out, so it, not the
// first result, ends a turn (PT-161: the last result is the answer).
export const STATE_EVENTS_ENV = { CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS: '1' } as const;

export const isStateEvent = (event: unknown): boolean =>
  isJson(event) && event.type === 'system' && event.subtype === 'session_state_changed';

export const isIdle = (event: unknown): boolean =>
  isStateEvent(event) && (event as { state?: unknown }).state === 'idle';

export const replayOf = (event: unknown): string | undefined =>
  isJson(event) &&
  event.type === 'user' &&
  event.isReplay === true &&
  typeof event.uuid === 'string'
    ? event.uuid
    : undefined;

const systemOf = (event: unknown, subtype: string): string | undefined =>
  isJson(event) &&
  event.type === 'system' &&
  event.subtype === subtype &&
  typeof event.task_id === 'string'
    ? event.task_id
    : undefined;

// Background work (a Bash shell, a sub agent) starts and ends as a task.
export const taskStartedOf = (event: unknown) => systemOf(event, 'task_started');
export const taskEndedOf = (event: unknown) => systemOf(event, 'task_notification');
