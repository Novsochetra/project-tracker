import {
  chainRound,
  chainStopReason,
  chainStoppedPush,
  nextChainStep,
  type ChainStop,
  type RunRole,
} from '@tracker/shared';
import { isUniqueViolation } from '../../db/errors';
import type { RunnerRow } from '../../db/runTables';
import { listTicketActivities } from '../../repositories/activities';
import { markChainStop } from '../../repositories/runChain';
import { findRunnerRow } from '../../repositories/runners';
import { insertRun, type RunWithKey } from '../../repositories/runs';
import { forUser, type ServiceContext } from '../context';
import { loadTicketScope, requireTicketById, ticketKeyOf, type TicketScope } from '../lookups';
import { ticketPrompt } from '../prompts';
import { pushToUser } from '../push';
import { notifyRun } from '../runMappers';
import { queuedRunRow } from '../runRows';
import { helperCanTake, personMovedSince } from './chainFacts';

interface ChainNext {
  role: RunRole;
  round: number;
}

interface ChainEnd {
  run: RunWithKey;
  ticket: TicketScope;
}

interface ChainLink extends ChainEnd {
  runner: RunnerRow;
}

async function chainTicket(ctx: ServiceContext, run: RunWithKey): Promise<TicketScope | null> {
  if (run.kind !== 'ticket' || run.status !== 'done' || !run.ticketId) return null;
  const ref = await requireTicketById(ctx.db, run.userId, run.ticketId);
  return ref.project.autoReview === 1 ? loadTicketScope(ctx.db, ref) : null;
}

async function stopChain(ctx: ServiceContext, { run, ticket }: ChainEnd, reason: ChainStop) {
  await markChainStop(ctx.db, run.id, reason);
  notifyRun(ctx, run.userId, { ...run, chainStop: reason });
  const pushed = { projectKey: run.projectKey, num: ticket.ticket.num, title: ticket.ticket.title };
  pushToUser(ctx, run.userId, chainStoppedPush(pushed, chainStopReason(reason, run.runnerName)));
}

// The next run gets the prompt the sheet would show now, so a rework reads the review.
async function queueChainRun(
  ctx: ServiceContext,
  link: ChainLink,
  next: ChainNext,
): Promise<boolean> {
  const { run, ticket, runner } = link;
  const prompt = await ticketPrompt(forUser(ctx, run.userId), ticketKeyOf(ticket));
  const queued = { scope: run.userId, runner, projectId: run.projectId, now: ctx.now() };
  const row = {
    ...queuedRunRow(queued, {
      prompt: prompt.text,
      kind: 'ticket',
      ticketId: ticket.ticket.id,
      chatId: null,
      resumeSessionId: null,
      askModel: null,
      askMode: null,
      askEffort: null,
      role: next.role,
    }),
    round: next.round,
  };
  try {
    await insertRun(ctx.db, row);
  } catch (error) {
    // A person started a run on the ticket in the moment between: theirs goes on instead.
    if (isUniqueViolation(error)) return false;
    throw error;
  }
  notifyRun(ctx, run.userId, row);
  return true;
}

async function chainStep(ctx: ServiceContext, run: RunWithKey): Promise<boolean> {
  const ticket = await chainTicket(ctx, run);
  if (!ticket) return false;
  const runner = run.runnerId ? await findRunnerRow(ctx.db, run.runnerId) : undefined;
  const role = run.role ?? 'work';
  const step = nextChainStep({
    run: { role, round: chainRound(role, run.round) },
    category: ticket.status.category,
    personMoved: personMovedSince(
      await listTicketActivities(ctx.db, ticket.ticket.id),
      run.createdAt,
    ),
    helperOnline: runner !== undefined && helperCanTake(runner, ticket.project.id, ctx.now()),
  });
  if (step.kind === 'stop') await stopChain(ctx, { run, ticket }, step.reason);
  if (step.kind === 'queue' && runner) return queueChainRun(ctx, { run, ticket, runner }, step);
  return step.kind === 'stop';
}

// Only a setting a person turned on starts these runs, so agents still can't start one (§1.11).
// The run has ended either way, so a step that fails is logged and the helper's report still lands.
export async function continueChain(ctx: ServiceContext, run: RunWithKey): Promise<boolean> {
  try {
    return await chainStep(ctx, run);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    console.warn(`The automatic review went no further after run ${run.id}: ${why}`);
    return false;
  }
}
