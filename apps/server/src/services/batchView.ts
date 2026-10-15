import {
  formatTicketKey,
  type BatchTicketState,
  type RunBatch,
  type RunStatus,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { notFound } from '../errors';
import { listBatchTicketRows } from '../repositories/batchRuns';
import type { ServiceContext } from './context';
import { expireSilentRuns, requireRun } from './runs';

const STATE_OF: Record<RunStatus, BatchTicketState> = {
  queued: 'waiting',
  running: 'running',
  done: 'done',
  failed: 'failed',
  cancelled: 'cancelled',
};

export const batchTicketState = (status: RunStatus): BatchTicketState => STATE_OF[status];

export async function getRunBatch(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<RunBatch> {
  await expireSilentRuns(ctx);
  const batch = await requireRun(ctx, scope, id);
  if (batch.kind !== 'batch') throw notFound('That batch was not found.');
  const rows = await listBatchTicketRows(ctx.db, [batch.id]);
  return {
    runId: batch.id,
    projectKey: batch.projectKey,
    status: batch.status,
    tickets: rows.map((row) => ({
      runId: row.runId,
      ticketKey: formatTicketKey(batch.projectKey, row.ticketNum),
      ticketTitle: row.ticketTitle,
      state: batchTicketState(row.status),
    })),
  };
}
