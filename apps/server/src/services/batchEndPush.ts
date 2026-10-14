import { batchEndedPush, formatTicketKey } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { listBatchTicketRows } from '../repositories/batchRuns';
import type { RunWithKey } from '../repositories/runs';
import type { ServiceContext } from './context';
import { pushToUser } from './push';

// Read once the batch's end is written, which ends what its tickets left with it.
export function pushBatchEnd(ctx: ServiceContext, scope: UserScope, batch: RunWithKey): void {
  const { id, projectKey, status, error } = batch;
  if (status !== 'done' && status !== 'failed') return;
  pushToUser(ctx, scope, async () => {
    const tickets = await listBatchTicketRows(ctx.db, [id]);
    const notDoneKeys = tickets
      .filter((ticket) => ticket.status !== 'done')
      .map((ticket) => formatTicketKey(projectKey, ticket.ticketNum));
    const reason = status === 'done' ? null : (error ?? 'no reason given');
    return batchEndedPush({ runId: id, projectKey, total: tickets.length, notDoneKeys }, reason);
  });
}
