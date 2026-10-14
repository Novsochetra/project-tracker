import type { Run } from '@tracker/shared';

// How the helper's window names a run: its ticket, its project's batch, or the start of its chat's id.
export const runName = (run: Pick<Run, 'kind' | 'projectKey' | 'ticketKey' | 'chatId'>): string => {
  if (run.kind === 'batch') return `${run.projectKey} batch`;
  return run.ticketKey ?? `chat ${(run.chatId ?? '').slice(0, 8)}`;
};
