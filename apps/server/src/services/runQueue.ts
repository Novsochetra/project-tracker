import type { RunJob } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { markRunStarted, nextQueuedRun } from '../repositories/runs';
import type { ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireUntakenRuns, requireRun } from './runs';

// The helper's side: its oldest waiting run, for a project it still serves, now running. Taking
// counts as checking in.
export async function takeNextRun(
  ctx: ServiceContext,
  scope: UserScope,
  runnerId: string,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, runner);
  await expireUntakenRuns(ctx);
  const next = await nextQueuedRun(ctx.db, scope, runner.id, parseProjectIds(runner));
  if (!next || !(await markRunStarted(ctx.db, next.id, ctx.now()))) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  return { run: toRun(started), prompt: started.prompt };
}
