import type { RunRequestRow } from '../db/runTables';
import {
  cancelRequestsOfEndedRuns,
  expireOverdueRequests,
  runsOfRequests,
} from '../repositories/runRequests';
import type { ServiceContext } from './context';
import { notifyRunRequest } from './runRequestMappers';
import { expireSilentRuns } from './runs';

async function notifyEnded(ctx: ServiceContext, rows: readonly RunRequestRow[]): Promise<void> {
  const runs = await runsOfRequests(ctx.db, [...new Set(rows.map((row) => row.runId))]);
  const byId = new Map(runs.map((run) => [run.id, run]));
  for (const row of rows) {
    const run = byId.get(row.runId);
    if (run) notifyRunRequest(ctx, run.userId, run, row);
  }
}

// Requests end when someone next looks, like silent runs: a request of a run that ended is
// cancelled (whichever way the run ended), and one past its deadline expired.
export async function settleRequests(ctx: ServiceContext): Promise<void> {
  await expireSilentRuns(ctx);
  const now = ctx.now();
  const cancelled = await cancelRequestsOfEndedRuns(ctx.db, now);
  const expired = await expireOverdueRequests(ctx.db, now);
  await notifyEnded(ctx, [...cancelled, ...expired]);
}
