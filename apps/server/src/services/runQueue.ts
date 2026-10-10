import type { RunJob } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { markRunStarted, nextQueuedRun } from '../repositories/runs';
import type { ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireUntakenRuns, requireRun } from './runs';

export async function takeNextRun(
  ctx: ServiceContext,
  scope: UserScope,
  runnerId: string,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, scope, runner);
  await expireUntakenRuns(ctx);
  const next = await nextQueuedRun(ctx.db, scope, runner.id, parseProjectIds(runner));
  if (!next || !(await markRunStarted(ctx.db, scope, next.id, ctx.now()))) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  return { run: toRun(started), prompt: started.prompt };
}
