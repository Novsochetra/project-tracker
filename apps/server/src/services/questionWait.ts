import { nextWaitMs, type TicketQuestion } from '@tracker/shared';
import type { UserContext } from './context';
import { longPoll } from './longPoll';
import { toQuestion } from './questionMappers';
import { requireQuestion } from './questions';
import { settleQuestions } from './questionSweep';

export async function waitForQuestion(
  ctx: UserContext,
  id: string,
  signal: AbortSignal,
): Promise<TicketQuestion> {
  const read = async () => {
    await settleQuestions(ctx);
    return requireQuestion(ctx, ctx.scope, id);
  };
  const row = await longPoll(ctx, {
    read,
    isOpen: (seen) => seen.status === 'open',
    wakes: (first) => ({
      change: ({ event }) => event.ticketId === first.ticketId,
      run: ({ event }) => event.type === 'run' && event.runId === first.runId,
    }),
    waitMs: (seen) => nextWaitMs(seen.expiresAt, ctx.now()),
    signal,
  });
  return toQuestion(row);
}
