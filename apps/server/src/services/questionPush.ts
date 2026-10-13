import { questionPush, type Actor } from '@tracker/shared';
import type { QuestionRow } from '../db/questionTables';
import { findQuestionRow } from '../repositories/questions';
import type { UserContext } from './context';
import type { TicketRef } from './lookups';
import { pushToUser } from './push';

// A person who asks on the ticket themselves learns nothing new, and a question answered before
// the push goes out no longer waits on them.
export function pushQuestion(
  ctx: UserContext,
  actor: Actor,
  ref: TicketRef,
  row: QuestionRow,
): void {
  if (actor.kind !== 'agent') return;
  const ticket = { projectKey: ref.project.key, num: ref.ticket.num, title: ref.ticket.title };
  pushToUser(ctx, ctx.scope, async () => {
    const now = await findQuestionRow(ctx.db, ctx.scope, row.id);
    return now?.status === 'open' ? questionPush({ ticket }, row.text) : null;
  });
}
