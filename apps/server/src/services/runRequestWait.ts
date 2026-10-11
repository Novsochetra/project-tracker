import { nextWaitMs, type RunRequest } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { forbidden } from '../errors';
import type { RunNotice } from '../events/runNotice';
import type { ServiceContext } from './context';
import { toRunRequest } from './runRequestMappers';
import { requireRunRequest } from './runRequests';
import { settleRequests } from './runRequestSweep';

// Only its request answered or ended, or the run's end, ends the wait: a sub agent that works
// meanwhile sends steps about once a second, and each would end the helper's long poll.
const ENDS_WAIT: ReadonlySet<RunNotice['event']['type']> = new Set(['run', 'run-request']);

function untilRunNotice(ctx: ServiceContext, runId: string, ms: number, signal: AbortSignal) {
  let stop = () => undefined as void;
  const woken = new Promise<void>((resolve) => {
    const timer = setTimeout(() => stop(), ms);
    const unsubscribe = ctx.runEvents.subscribe(({ event }) => {
      if (ENDS_WAIT.has(event.type) && 'runId' in event && event.runId === runId) stop();
    });
    stop = () => {
      clearTimeout(timer);
      unsubscribe();
      signal.removeEventListener('abort', stop);
      resolve();
    };
    signal.addEventListener('abort', stop);
    if (signal.aborted) stop();
  });
  return { woken, stop: () => stop() };
}

export async function waitForRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  { runnerId, signal }: { runnerId: string; signal: AbortSignal },
): Promise<RunRequest> {
  await settleRequests(ctx);
  const first = await requireRunRequest(ctx, scope, id);
  if (first.run.runnerId !== runnerId) {
    throw forbidden('Only the helper that took this run waits for its requests.');
  }
  if (first.row.status !== 'open') return toRunRequest(first.row);
  const wait = untilRunNotice(
    ctx,
    first.run.id,
    nextWaitMs(first.row.expiresAt, ctx.now()),
    signal,
  );
  // Settle and read again once listening, so an answer or a run's end in between isn't missed.
  await settleRequests(ctx);
  const again = await requireRunRequest(ctx, scope, id);
  if (again.row.status !== 'open') wait.stop();
  await wait.woken;
  await settleRequests(ctx);
  return toRunRequest((await requireRunRequest(ctx, scope, id)).row);
}
