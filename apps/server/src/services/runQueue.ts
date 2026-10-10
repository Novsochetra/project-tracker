import { RUN_RESTARTED, type RunJob } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import { failRunsOf, markRunStarted, nextQueuedRun } from '../repositories/runs';
import type { ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireSilentRuns, requireRun } from './runs';

// A helper asks only when it has no run, so a run it still has was lost in a restart.
async function endLostRuns(ctx: ServiceContext, scope: UserScope, runner: RunnerRow) {
  const lost = await failRunsOf(
    ctx.db,
    scope,
    { runnerId: runner.id, statuses: ['running'] },
    {
      error: RUN_RESTARTED,
      endedAt: ctx.now(),
    },
  );
  for (const run of lost) notifyRun(ctx, scope, run);
}

export async function takeNextRun(
  ctx: ServiceContext,
  scope: UserScope,
  runnerId: string,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, scope, runner);
  await expireSilentRuns(ctx);
  await endLostRuns(ctx, scope, runner);
  const next = await nextQueuedRun(ctx.db, scope, runner.id, parseProjectIds(runner));
  if (!next || !(await markRunStarted(ctx.db, scope, next.id, ctx.now()))) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  return { run: toRun(started), prompt: started.prompt };
}
