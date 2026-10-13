import { nextWaitMs, type RunRequest } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { forbidden } from '../errors';
import type { RunNotice } from '../events/runNotice';
import type { ServiceContext } from './context';
import { longPoll } from './longPoll';
import { toRunRequest } from './runRequestMappers';
import { requireRunRequest } from './runRequests';
import { settleRequests } from './runRequestSweep';

// Only its request answered or ended, or the run's end, ends the wait: a sub agent that works
// meanwhile sends steps about once a second, and each would end the helper's long poll.
const ENDS_WAIT: ReadonlySet<RunNotice['event']['type']> = new Set(['run', 'run-request']);

export async function waitForRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  { runnerId, signal }: { runnerId: string; signal: AbortSignal },
): Promise<RunRequest> {
  const read = async () => {
    await settleRequests(ctx);
    const found = await requireRunRequest(ctx, scope, id);
    if (found.run.runnerId !== runnerId) {
      throw forbidden('Only the helper that took this run waits for its requests.');
    }
    return found;
  };
  const { row } = await longPoll(ctx, {
    read,
    isOpen: (seen) => seen.row.status === 'open',
    wakes: ({ run }) => ({
      run: ({ event }) => ENDS_WAIT.has(event.type) && 'runId' in event && event.runId === run.id,
    }),
    waitMs: (seen) => nextWaitMs(seen.row.expiresAt, ctx.now()),
    signal,
  });
  return toRunRequest(row);
}
