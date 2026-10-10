import type { Run } from '@tracker/shared';

// How the helper's window names a run: its ticket, or the start of its chat's id.
export const labelOf = (run: Pick<Run, 'ticketKey' | 'chatId'>): string =>
  run.ticketKey ?? `chat ${(run.chatId ?? '').slice(0, 8)}`;
