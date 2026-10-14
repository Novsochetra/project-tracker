import {
  BATCH_NEEDS_NEW_HELPER,
  formatTicketKey,
  RUN_RESTARTED,
  withWithheldFiles,
  type RunJob,
  type RunLane,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import {
  endOrphanBatchTickets,
  failQueuedBatchesOf,
  listBatchTicketRows,
} from '../repositories/batchRuns';
import { holdProjectRuns } from '../repositories/projects';
import { failRunsOf, markRunStarted, nextQueuedRun, type RunWithKey } from '../repositories/runs';
import { chatFilesFor } from './chatChanges/turnFiles';
import { runFiles } from './chatFiles';
import { inTransaction, type ServiceContext } from './context';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner, touchRunner } from './runners';
import { expireSilentRuns, requireRun } from './runs';

// A helper asks for a lane's next run only when that lane is free, so a run of the lane it still
// has was lost in a restart.
async function endLostRuns(
  ctx: ServiceContext,
  scope: UserScope,
  runner: RunnerRow,
  lane: RunLane,
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

// A helper that can't run a batch would leave it waiting with no word why, so it ends with one.
async function endBatchesFor(ctx: ServiceContext, scope: UserScope, runner: RunnerRow) {
  const ending = { error: BATCH_NEEDS_NEW_HELPER, endedAt: ctx.now() };
  const failed = await failQueuedBatchesOf(ctx.db, runner.id, ending);
  if (failed.length === 0) return;
  const held = await endOrphanBatchTickets(ctx.db, ending);
  for (const run of [...failed, ...held]) notifyRun(ctx, scope, run);
}

export interface Take {
  lane: RunLane | undefined;
  batches: boolean;
}

export async function takeNextRun(
  ctx: ServiceContext,
  scope: UserScope,
  runnerId: string,
  { lane, batches }: Take,
): Promise<RunJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await touchRunner(ctx, scope, runner);
  await expireSilentRuns(ctx);
  await endLostRuns(ctx, scope, runner, lane ?? 'ticket');
  if (lane !== 'ask' && !batches) await endBatchesFor(ctx, scope, runner);
  const slot = { runnerId: runner.id, lane, batches, projectIds: parseProjectIds(runner) };
  const next = await nextQueuedRun(ctx.db, scope, slot);
  if (!next) return null;
  const marked = await inTransaction(ctx, async (trx) => {
    await holdProjectRuns(trx, next.projectId);
    return markRunStarted(trx, scope, next.id, ctx.now());
  });
  if (!marked) return null;
  const started = await requireRun(ctx, scope, next.id);
  notifyRun(ctx, scope, started);
  const { files, withheld } = await runFiles(ctx.db, started);
  const prompt = withWithheldFiles(started.prompt, withheld);
  const ticketKeys = await batchTicketKeys(ctx, started);
  const chatFiles = await chatFilesFor(ctx.db, started);
  const { resumeSessionId } = started;
  const job = { run: toRun(started), prompt, resumeSessionId, files, ticketKeys };
  return chatFiles ? { ...job, chatFiles } : job;
}

async function batchTicketKeys(ctx: ServiceContext, run: RunWithKey): Promise<string[]> {
  if (run.kind !== 'batch') return [];
  const rows = await listBatchTicketRows(ctx.db, [run.id]);
  return rows.map((row) => formatTicketKey(run.projectKey, row.ticketNum));
}
