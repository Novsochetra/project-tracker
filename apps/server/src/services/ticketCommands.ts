import { randomUUID } from 'node:crypto';
import {
  planMove,
  type Actor,
  type createTicketInput,
  type moveTicketInput,
  type Ticket,
  type updateTicketInput,
} from '@tracker/shared';
import type { z } from 'zod';
import type { Clock } from '../clock';
import type { Db, ProjectRow, TicketRow } from '../db/schema';
import { insertActivity } from '../repositories/activities';
import { storageKeysOfTicket } from '../repositories/attachments';
import { takeTicketNumber, updateProjectRow } from '../repositories/projects';
import { listStatusRows } from '../repositories/statuses';
import {
  deleteTicketRow,
  findTicketByClientId,
  insertTicket,
  listTicketRows,
  updateTicketRow,
} from '../repositories/tickets';
import { removeFiles } from '../storage/fileStorage';
import { isEmpty } from '../util';
import { attachUploads } from './attachmentLinks';
import { inTransaction, notify, type ServiceContext } from './context';
import {
  requireProject,
  requireStatusIn,
  requireTicket,
  requireTicketScope,
  type TicketScope,
} from './lookups';
import { toTicket } from './mappers';
import { fieldChanges, mergeChanges, type PlannedChange } from './ticketChanges';
import { activityRow, assertMayEnter, enterStatus, eventEntry, writeTicket } from './ticketWrites';

type CreateTicketValues = z.output<typeof createTicketInput>;
type UpdateTicketValues = z.output<typeof updateTicketInput>;
type MoveTicketValues = z.output<typeof moveTicketInput>;

interface Outcome {
  ticket: Ticket;
  changed: boolean;
}

function finish(ctx: ServiceContext, outcome: Outcome): Ticket {
  if (outcome.changed) notify(ctx, outcome.ticket.projectId, outcome.ticket.id);
  return outcome.ticket;
}

interface NewTicket {
  actor: Actor;
  project: ProjectRow;
  input: CreateTicketValues;
}

async function insertNewTicket(trx: Db, now: Clock, request: NewTicket): Promise<Ticket> {
  const { actor, project, input } = request;
  const statuses = await listStatusRows(trx, project.id);
  const status = input.statusId ? requireStatusIn(statuses, input.statusId) : statuses[0];
  if (!status) throw new Error(`Project ${project.key} has no statuses.`);
  const placement = await enterStatus(trx, actor, status);
  const num = await takeTicketNumber(trx, project.id);
  const at = now();
  const row: TicketRow = {
    id: randomUUID(),
    projectId: project.id,
    num,
    ...placement,
    title: input.title,
    description: input.description,
    priority: input.priority,
    assignee: input.assignee,
    due: input.due,
    createdAt: at,
    updatedAt: at,
    clientId: input.clientId ?? null,
  };
  await insertTicket(trx, row);
  const created = { ticketId: row.id, actor, type: 'event' as const, at };
  await insertActivity(trx, activityRow({ ...created, text: 'created the ticket' }));
  await attachUploads(trx, input.attachmentIds, { ticketId: row.id, activityId: null });
  return toTicket(row, project.key);
}

// A create that repeats a client id in the project gets the ticket the first one made. Looked up
// inside the transaction: SQLite and PGlite run transactions one at a time, so two identical
// creates at once make one ticket and take one number. On Postgres with several connections the
// unique index refuses the second one, and sending it again gets the ticket.
export async function createTicket(
  ctx: ServiceContext,
  actor: Actor,
  projectKey: string,
  input: CreateTicketValues,
): Promise<Ticket> {
  const outcome = await inTransaction(ctx, async (trx): Promise<Outcome> => {
    const project = await requireProject(trx, projectKey);
    const earlier = input.clientId
      ? await findTicketByClientId(trx, project.id, input.clientId)
      : undefined;
    if (earlier) return { ticket: toTicket(earlier, project.key), changed: false };
    return {
      ticket: await insertNewTicket(trx, ctx.now, { actor, project, input }),
      changed: true,
    };
  });
  return finish(ctx, outcome);
}

async function statusChange(
  trx: Db,
  actor: Actor,
  scope: TicketScope,
  statusId: string | undefined,
): Promise<PlannedChange> {
  if (statusId === undefined || statusId === scope.ticket.statusId) return mergeChanges([]);
  const status = requireStatusIn(scope.statuses, statusId);
  return {
    changes: await enterStatus(trx, actor, status),
    entries: [eventEntry(`changed status to ${status.name}`)],
  };
}

export async function updateTicket(
  ctx: ServiceContext,
  actor: Actor,
  key: string,
  input: UpdateTicketValues,
): Promise<Ticket> {
  const outcome = await inTransaction(ctx, async (trx): Promise<Outcome> => {
    const scope = await requireTicketScope(trx, key);
    const plan = mergeChanges([
      await statusChange(trx, actor, scope, input.statusId),
      fieldChanges(scope.ticket, input, new Date()),
    ]);
    if (isEmpty(plan.changes)) {
      return { ticket: toTicket(scope.ticket, scope.project.key), changed: false };
    }
    const written = await writeTicket(trx, ctx.now, { ticket: scope.ticket, actor, ...plan });
    return { ticket: toTicket(written.ticket, scope.project.key), changed: true };
  });
  return finish(ctx, outcome);
}

export async function deleteTicket(ctx: ServiceContext, key: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const ref = await requireTicket(trx, key);
    const files = await storageKeysOfTicket(trx, ref.ticket.id);
    await deleteTicketRow(trx, ref.ticket.id);
    await updateProjectRow(trx, ref.project.id, { updatedAt: ctx.now() });
    return { ref, files };
  });
  await removeFiles(ctx.storage, removed.files);
  notify(ctx, removed.ref.project.id, removed.ref.ticket.id);
}

export async function moveTicket(
  ctx: ServiceContext,
  actor: Actor,
  key: string,
  input: MoveTicketValues,
): Promise<Ticket> {
  const outcome = await inTransaction(ctx, async (trx): Promise<Outcome> => {
    const scope = await requireTicketScope(trx, key);
    const status = requireStatusIn(scope.statuses, input.statusId);
    const tickets = await listTicketRows(trx, scope.project.id);
    const plan = planMove(tickets, scope.ticket.id, { ...input, statusId: status.id });
    if (!plan) return { ticket: toTicket(scope.ticket, scope.project.key), changed: false };
    if (plan.statusChanged) assertMayEnter(actor, status);
    for (const [id, rank] of plan.ranks) {
      if (id !== scope.ticket.id) await updateTicketRow(trx, id, { rank });
    }
    const written = await writeTicket(trx, ctx.now, {
      ticket: scope.ticket,
      actor,
      changes: { statusId: status.id, rank: plan.ranks.get(scope.ticket.id) ?? scope.ticket.rank },
      entries: plan.statusChanged ? [eventEntry(`changed status to ${status.name}`)] : [],
    });
    return { ticket: toTicket(written.ticket, scope.project.key), changed: true };
  });
  return finish(ctx, outcome);
}
