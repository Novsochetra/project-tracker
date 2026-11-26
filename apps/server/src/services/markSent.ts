import { resolveStatus, type Actor, type markSentInput, type Ticket } from '@tracker/shared';
import type { z } from 'zod';
import { inTransaction, notify, type UserContext } from './context';
import { requireTicketScope } from './lookups';
import { WORKFLOW_VERBS } from './statusEvents';
import { ticketOut } from './ticketOut';
import { writeTicket } from './ticketWrites';
import { transition } from './workflow';

type SentValues = z.output<typeof markSentInput>;

export async function markSent(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: SentValues,
): Promise<Ticket> {
  const ticket = await inTransaction(ctx, async (trx) => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
    const moves = input.moveToInProgress && scope.status.category === 'todo';
    const target = moves ? resolveStatus(scope.statuses, 'in_progress') : scope.status;
    const plan = await transition(trx, actor, scope, {
      target,
      verb: WORKFLOW_VERBS.send,
    });
    const written = await writeTicket(trx, ctx.now, { ticket: scope.ticket, actor, ...plan });

    return ticketOut(trx, written.ticket, scope.project.key);
  });
  notify(ctx, ticket.projectId, ticket.id);

  return ticket;
}
