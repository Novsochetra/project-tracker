import {
  pickNextTicket,
  resolveStatus,
  type Actor,
  type markSentInput,
  type reviewInput,
  type StatusCategory,
  type submitWorkInput,
  type Ticket,
  type TicketDetail,
} from '@tracker/shared';
import type { z } from 'zod';
import type { Db, StatusRow } from '../db/schema';
import { conflict } from '../errors';
import { listStatusRows } from '../repositories/statuses';
import { listTicketRows } from '../repositories/tickets';
import { inTransaction, notify, type UserContext } from './context';
import { requireProject, requireTicketScope, ticketKeyOf, type TicketScope } from './lookups';
import { toTicket } from './mappers';
import { pushToUser } from './push';
import { readyPush } from './reviewPush';
import type { PlannedChange } from './ticketChanges';
import { getTicketDetailById } from './ticketQueries';
import { enterStatus, eventEntry, writeTicket, type WrittenTicket } from './ticketWrites';

type SentValues = z.output<typeof markSentInput>;
type SubmitValues = z.output<typeof submitWorkInput>;
type ReviewValues = z.output<typeof reviewInput>;

const CLAIMABLE: ReadonlySet<StatusCategory> = new Set(['todo', 'in_progress']);

async function transition(
  trx: Db,
  actor: Actor,
  scope: TicketScope,
  move: { target: StatusRow; verb: string },
): Promise<PlannedChange> {
  if (move.target.id === scope.status.id) return { changes: {}, entries: [eventEntry(move.verb)] };
  return {
    changes: await enterStatus(trx, actor, move.target),
    entries: [eventEntry(`${move.verb} and moved it to ${move.target.name}`)],
  };
}

async function finishDetail(ctx: UserContext, written: WrittenTicket): Promise<TicketDetail> {
  notify(ctx, written.ticket.projectId, written.ticket.id);
  return getTicketDetailById(ctx.db, ctx.scope, written.ticket.id);
}

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
      verb: 'sent the ticket to Claude Code',
    });
    const written = await writeTicket(trx, ctx.now, { ticket: scope.ticket, actor, ...plan });
    return toTicket(written.ticket, scope.project.key);
  });
  notify(ctx, ticket.projectId, ticket.id);
  return ticket;
}

async function claimInScope(
  trx: Db,
  ctx: UserContext,
  actor: Actor,
  scope: TicketScope,
): Promise<WrittenTicket> {
  if (!CLAIMABLE.has(scope.status.category)) {
    throw conflict(`${ticketKeyOf(scope)} is in ${scope.status.name} and can't be claimed.`);
  }
  const target =
    scope.status.category === 'todo' ? resolveStatus(scope.statuses, 'in_progress') : scope.status;
  const plan = await transition(trx, actor, scope, { target, verb: 'picked up the ticket' });
  const takesOver = actor.kind === 'agent' && !scope.ticket.assignee;
  return writeTicket(trx, ctx.now, {
    ticket: scope.ticket,
    actor,
    changes: { ...plan.changes, ...(takesOver ? { assignee: actor.name } : {}) },
    entries: plan.entries,
    guardStatus: true,
  });
}

export async function claimTicket(
  ctx: UserContext,
  actor: Actor,
  key: string,
): Promise<TicketDetail> {
  const written = await inTransaction(ctx, async (trx) =>
    claimInScope(trx, ctx, actor, await requireTicketScope(trx, ctx.scope, key)),
  );
  return finishDetail(ctx, written);
}

export async function claimNext(
  ctx: UserContext,
  actor: Actor,
  projectKey: string,
): Promise<TicketDetail | null> {
  const written = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, ctx.scope, projectKey);
    const statuses = await listStatusRows(trx, project.id);
    const ticket = pickNextTicket(await listTicketRows(trx, project.id), statuses);
    const status = statuses.find((candidate) => candidate.id === ticket?.statusId);
    if (!ticket || !status) return null;
    return claimInScope(trx, ctx, actor, { ticket, project, statuses, status });
  });
  return written ? finishDetail(ctx, written) : null;
}

export const submittedReport = (key: string, input: SubmitValues): string =>
  [
    `TICKET: ${key}`,
    'STATUS: done',
    `SUMMARY: ${input.summary}`,
    `FILES: ${input.files.trim() || 'none'}`,
    // Only when given, so a submission without attached results reads as before.
    ...(input.output.trim() ? [`OUTPUT: ${input.output.trim()}`] : []),
    `NEXT: ${input.next.trim() || 'none'}`,
  ].join('\n');

export async function submitWork(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: SubmitValues,
): Promise<TicketDetail> {
  const written = await inTransaction(ctx, async (trx) => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
    const target = resolveStatus(scope.statuses, 'in_review');
    const plan = await transition(trx, actor, scope, { target, verb: 'submitted the work' });
    return writeTicket(trx, ctx.now, {
      ticket: scope.ticket,
      actor,
      changes: plan.changes,
      entries: [
        { type: 'report', text: submittedReport(ticketKeyOf(scope), input) },
        ...plan.entries,
      ],
    });
  });
  return finishDetail(ctx, written);
}

export async function reviewTicket(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: ReviewValues,
): Promise<TicketDetail> {
  const { written, ready } = await inTransaction(ctx, async (trx) => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
    if (scope.status.category !== 'in_review') {
      throw conflict(`${ticketKeyOf(scope)} is not waiting for review.`);
    }
    const approved = input.verdict === 'approved';
    const target = resolveStatus(scope.statuses, approved ? 'reviewed' : 'todo');
    const plan = await transition(trx, actor, scope, {
      target,
      verb: approved ? 'approved the work' : 'requested changes',
    });
    const review = { verdict: input.verdict, rating: input.rating };
    const ticket = await writeTicket(trx, ctx.now, {
      ticket: scope.ticket,
      actor,
      changes: plan.changes,
      entries: [{ type: 'review', text: input.summary, review }, ...plan.entries],
    });
    return { written: ticket, ready: readyPush(actor, scope, { target, rating: input.rating }) };
  });
  if (ready) pushToUser(ctx, ctx.scope, ready);
  return finishDetail(ctx, written);
}
