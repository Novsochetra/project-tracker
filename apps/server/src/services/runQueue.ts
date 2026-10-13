import { RUN_RESTARTED, type RunJob, type RunKind } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import { failRunsOf, markRunStarted, nextQueuedRun } from '../repositories/runs';
import { runFiles } from './chatFiles';
import type { ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireSilentRuns, requireRun } from './runs';

// A helper asks for a lane's next run only when that lane is free, so a run of the lane it still
// has was lost in a restart.
async function endLostRuns(
  ctx: ServiceContext,
  scope: UserScope,
  runner: RunnerRow,
  lane: RunKind,
) {
  const lost = await failRunsOf(
    ctx.db,
    scope,
    { runnerId: runner.id, statuses: ['running'], lane },
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
  lane: RunKind | undefined,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, scope, runner);
  await expireSilentRuns(ctx);
  await endLostRuns(ctx, scope, runner, lane ?? 'ticket');
  const slot = { runnerId: runner.id, lane, projectIds: parseProjectIds(runner) };
  const next = await nextQueuedRun(ctx.db, scope, slot);
  if (!next || !(await markRunStarted(ctx.db, scope, next.id, ctx.now()))) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  const files = await runFiles(ctx.db, started);
  const { prompt, resumeSessionId } = started;
  return { run: toRun(started), prompt, resumeSessionId, files };
}
