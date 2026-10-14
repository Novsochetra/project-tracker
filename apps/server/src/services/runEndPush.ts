import { runEndedPush } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunWithKey } from '../repositories/runs';
import { findTicketById } from '../repositories/tickets';
import { pushBatchEnd } from './batchEndPush';
import { pushAnswer } from './chatAnswers';
import type { ServiceContext } from './context';
import { pushToUser } from './push';
import type { RunEnding } from './runEnding';

// A cancel is the person's own doing, so it tells them nothing new.
function pushTicketRunEnd(ctx: ServiceContext, scope: UserScope, run: RunWithKey): void {
  const { ticketId, ticketNum, projectKey, status, error } = run;
  if (!ticketId || ticketNum === null || (status !== 'done' && status !== 'failed')) return;
  pushToUser(ctx, scope, async () => {
    const ticket = await findTicketById(ctx.db, ticketId);
    if (!ticket) return null;
    const reason = status === 'done' ? null : (error ?? 'no reason given');
    return runEndedPush({ projectKey, num: ticketNum, title: ticket.title }, reason);
  });
}

export function pushRunEnd(
  ctx: ServiceContext,
  scope: UserScope,
  run: RunWithKey,
  { answer }: Pick<RunEnding, 'answer'>,
): void {
  if (run.kind === 'ticket') pushTicketRunEnd(ctx, scope, run);
  else if (run.kind === 'batch') pushBatchEnd(ctx, scope, run);
  else if (answer) pushAnswer(ctx, scope, run, answer);
}
