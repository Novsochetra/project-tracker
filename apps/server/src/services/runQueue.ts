import { RUN_RESTARTED, type RunJob, type RunKind } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import { failRunsOf, markRunStarted, nextQueuedRun } from '../repositories/runs';
import type { ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireSilentRuns, requireRun } from './runs';

// A helper asks for a kind only when it has no run of it, so a run of that kind it still has was
// lost in a restart.
async function endLostRuns(
  ctx: ServiceContext,
  scope: UserScope,
  runner: RunnerRow,
  kind: RunKind,
) {
  const lost = await failRunsOf(
    ctx.db,
    scope,
    { runnerId: runner.id, statuses: ['running'], kind },
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
  kind: RunKind,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, scope, runner);
  await expireSilentRuns(ctx);
  await endLostRuns(ctx, scope, runner, kind);
  const slot = { runnerId: runner.id, kind, projectIds: parseProjectIds(runner) };
  const next = await nextQueuedRun(ctx.db, scope, slot);
  if (!next || !(await markRunStarted(ctx.db, scope, next.id, ctx.now()))) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  return { run: toRun(started), prompt: started.prompt, resumeSessionId: started.resumeSessionId };
}
