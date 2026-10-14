import {
  resolveStatus,
  type Actor,
  type ChangesVerdictInput,
  type ReviewVerdict,
  type TicketDetail,
} from '@tracker/shared';
import type { StatusRow } from '../../db/schema';
import { conflict } from '../../errors';
import { latestTicketChanges, setChangesVerdict } from '../../repositories/runChanges';
import { inTransaction, notify, type UserContext } from '../context';
import { requireTicketScope, type TicketScope } from '../lookups';
import { WORKFLOW_VERBS } from '../statusEvents';
import { getTicketDetailById } from '../ticketQueries';
import { writeTicket } from '../ticketWrites';
import { transition } from '../workflow';

// Approve takes a ticket waiting for review on to Reviewed and leaves one anywhere else where it
// is. Ask for changes sends it to the top of To do, where the next run reads the line comments in
// its prompt.
function targetOf({ status, statuses }: TicketScope, verdict: ReviewVerdict): StatusRow {
  if (verdict === 'approved') {
    return status.category === 'in_review' ? resolveStatus(statuses, 'reviewed') : status;
  }
  return status.category === 'todo' ? status : resolveStatus(statuses, 'todo');
}

const VERBS = {
  approved: WORKFLOW_VERBS.approveChanges,
  changes_requested: WORKFLOW_VERBS.askForChanges,
} as const;

export async function changesVerdict(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: ChangesVerdictInput,
): Promise<TicketDetail> {
  const written = await inTransaction(ctx, async (trx) => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
    const latest = await latestTicketChanges(trx, scope.ticket.id);
    if (latest?.runId !== input.runId) {
      throw conflict('Claude changed more since you looked. Look at the changes again.');
    }
    await setChangesVerdict(trx, latest.runId, input.verdict);
    const target = targetOf(scope, input.verdict);
    const plan = await transition(trx, actor, scope, { target, verb: VERBS[input.verdict] });
    return writeTicket(trx, ctx.now, { ticket: scope.ticket, actor, ...plan });
  });
  notify(ctx, written.ticket.projectId, written.ticket.id);
  return getTicketDetailById(ctx.db, ctx.scope, written.ticket.id);
}
