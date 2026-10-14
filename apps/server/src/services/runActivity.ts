import {
  DEFAULT_MAX_PARALLEL_RUNS,
  FAILED_RUN_SHOWN_MS,
  formatTicketKey,
  projectDisplayName,
  type ActivityBatch,
  type ActivityRun,
  type RunActivity,
  type RunStatus,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Db } from '../db/schema';
import { listBatchTicketRows } from '../repositories/batchRuns';
import {
  listActivityBatchRows,
  listActivityRunRows,
  type ActivityRunRow,
} from '../repositories/runs';
import type { ServiceContext } from './context';
import { expireSilentRuns } from './runs';

const stateOf = (status: RunStatus): ActivityRun['state'] =>
  status === 'queued' ? 'waiting' : status === 'running' ? 'running' : 'failed';

// Activity is only the person's screen, so it gets the stand-in like every other screen.
const shownName = (row: { projectKey: string; projectName: string; projectHideName: number }) =>
  projectDisplayName({
    name: row.projectName,
    key: row.projectKey,
    hideName: row.projectHideName === 1,
  });

const toActivityRun = (row: ActivityRunRow): ActivityRun => ({
  runId: row.runId,
  batchId: row.batchId,
  projectKey: row.projectKey,
  projectName: shownName(row),
  ticketKey: formatTicketKey(row.projectKey, row.ticketNum),
  ticketTitle: row.ticketTitle,
  state: stateOf(row.status),
  startedAt: row.startedAt,
  createdAt: row.createdAt,
});

// An ended batch stays only while it failed or left tickets failed, which the person must look at.
async function listBatches(db: Db, scope: UserScope, since: number): Promise<ActivityBatch[]> {
  const rows = await listActivityBatchRows(db, scope, since);
  const held = await listBatchTicketRows(
    db,
    rows.map(({ runId }) => runId),
  );
  const batches = rows.map((row): ActivityBatch => {
    const tickets = held.filter(({ batchId }) => batchId === row.runId);
    return {
      runId: row.runId,
      projectKey: row.projectKey,
      projectName: shownName(row),
      state: stateOf(row.status),
      total: tickets.length,
      done: tickets.filter(({ status }) => status === 'done').length,
      failedKeys: tickets
        .filter(({ status }) => status === 'failed')
        .map(({ ticketNum }) => formatTicketKey(row.projectKey, ticketNum)),
      startedAt: row.startedAt,
      createdAt: row.createdAt,
    };
  });
  const shown: ReadonlySet<RunStatus> = new Set(['queued', 'running', 'failed']);
  return batches.filter(
    (batch, index) => shown.has(rows[index]?.status ?? 'done') || batch.failedKeys.length > 0,
  );
}

export async function listRunActivity(ctx: ServiceContext, scope: UserScope): Promise<RunActivity> {
  await expireSilentRuns(ctx);
  const since = ctx.now() - FAILED_RUN_SHOWN_MS;
  const rows = await listActivityRunRows(ctx.db, scope, since);
  const runs = rows.map(toActivityRun);
  return {
    runs,
    batches: await listBatches(ctx.db, scope, since),
    runningCount: runs.filter((run) => run.state === 'running').length,
    limit: DEFAULT_MAX_PARALLEL_RUNS,
  };
}
