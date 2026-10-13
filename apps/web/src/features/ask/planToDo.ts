import type { AskOptions, Chat, ChatDetail, Run, Runner } from '@tracker/shared';
import { helpersFor } from '../claude/runs';
import { savedAskOptions } from './askOptions';

// Only Claude's latest answer, to a Plan question that ended: an older plan may be out of date,
// and while a question runs the next answer may change the plan.
export function planToDo(
  detail: Pick<ChatDetail, 'messages' | 'run'> | null | undefined,
): Run | null {
  const run = detail?.run;
  if (!run || run.status !== 'done' || run.askOptions?.mode !== 'plan') return null;
  const last = detail.messages.at(-1);
  return last?.role === 'claude' && last.runId === run.id ? run : null;
}

// The helper that made the plan, since only its session resumes with the plan in context.
export const planHelper = (
  run: Pick<Run, 'runnerId'>,
  runners: readonly Runner[],
  projectKey: string,
): Runner | null => helpersFor(runners, projectKey).find(({ id }) => id === run.runnerId) ?? null;

export const doItOptions = (chat: Pick<Chat, 'options'>): AskOptions => ({
  ...savedAskOptions(chat),
  mode: 'edit',
});
