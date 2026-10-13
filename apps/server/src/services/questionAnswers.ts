import type { Actor, AnswerQuestionInput, TicketQuestion } from '@tracker/shared';
import type { QuestionRow } from '../db/questionTables';
import { conflict } from '../errors';
import {
  markQuestionCancelled,
  markQuestionEnded,
  type QuestionEnd,
} from '../repositories/questions';
import { inTransaction, type UserContext } from './context';
import { requireTicketById } from './lookups';
import { notifyQuestion, toQuestion } from './questionMappers';
import { requireQuestion } from './questions';
import { settleQuestions } from './questionSweep';
import { eventEntry, writeTicket } from './ticketWrites';

const ENDED: Readonly<Record<QuestionRow['status'], string>> = {
  open: 'Claude no longer waits for this.',
  answered: 'This was already answered.',
  skipped: 'This was already skipped.',
  expired: 'Nobody answered in time, so Claude went on without it.',
  cancelled: 'Claude no longer waits for this.',
};

const endOf = (input: AnswerQuestionInput, endedAt: number): QuestionEnd =>
  'answer' in input
    ? { status: 'answered', answer: input.answer, endedAt }
    : { status: 'skipped', answer: null, endedAt };

const eventOf = (row: QuestionRow, end: QuestionEnd): string =>
  end.answer === null ? `skipped the question: ${row.text}` : `answered: ${end.answer}`;

export async function answerQuestion(
  ctx: UserContext,
  actor: Actor,
  id: string,
  input: AnswerQuestionInput,
): Promise<TicketQuestion> {
  await settleQuestions(ctx);
  const row = await requireQuestion(ctx, ctx.scope, id);
  const ref = await inTransaction(ctx, async (trx) => {
    const ref = await requireTicketById(trx, ctx.scope, row.ticketId);
    const end = endOf(input, ctx.now());
    if (!(await markQuestionEnded(trx, row.id, end))) return null;
    await writeTicket(trx, ctx.now, {
      ticket: ref.ticket,
      actor,
      entries: [eventEntry(eventOf(row, end))],
    });
    return ref;
  });
  if (!ref) {
    await settleQuestions(ctx);
    throw conflict(ENDED[(await requireQuestion(ctx, ctx.scope, id)).status]);
  }
  notifyQuestion(ctx, ctx.scope, ref.project.id, ref.ticket.id);
  return toQuestion(await requireQuestion(ctx, ctx.scope, id));
}

// One that already ended stays as it ended: Claude may give up just as the person answers, and
// the answer then stands.
export async function cancelQuestion(ctx: UserContext, id: string): Promise<TicketQuestion> {
  await settleQuestions(ctx);
  const row = await requireQuestion(ctx, ctx.scope, id);
  if (await markQuestionCancelled(ctx.db, row.id, ctx.now())) {
    const ref = await requireTicketById(ctx.db, ctx.scope, row.ticketId);
    notifyQuestion(ctx, ctx.scope, ref.project.id, ref.ticket.id);
  }
  return toQuestion(await requireQuestion(ctx, ctx.scope, id));
}
