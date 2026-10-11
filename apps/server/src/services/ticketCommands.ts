import { randomUUID } from 'node:crypto';
import {
  planMove,
  type Actor,
  type CreatedTicket,
  type createTicketInput,
  type moveTicketInput,
  type Ticket,
  type updateTicketInput,
} from '@tracker/shared';
import type { z } from 'zod';
import { isUniqueViolation } from '../db/errors';
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
import { attachLaterUploads, attachUploads } from './attachmentLinks';
import { inTransaction, notify, type UserContext } from './context';
import { expectedMatch, type ExpectedValues } from './expectedFields';
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

interface Outcome<T extends Ticket = Ticket> {
  ticket: T;
  changed: boolean;
}

function finish<T extends Ticket>(ctx: UserContext, outcome: Outcome<T>): T {
  if (outcome.changed) notify(ctx, outcome.ticket.projectId, outcome.ticket.id);
  return outcome.ticket;
}

interface NewTicket {
  actor: Actor;
  project: ProjectRow;
  input: CreateTicketValues;
}

async function insertNewTicket(trx: Db, ctx: UserContext, request: NewTicket): Promise<Ticket> {
  const { actor, project, input } = request;
  const statuses = await listStatusRows(trx, project.id);
  const status = input.statusId ? requireStatusIn(statuses, input.statusId) : statuses[0];
  if (!status) throw new Error(`Project ${project.key} has no statuses.`);
  const placement = await enterStatus(trx, actor, status);
  const num = await takeTicketNumber(trx, project.id);
  const at = ctx.now();
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
  const target = { ticketId: row.id, activityId: null, uploader: ctx.scope };
  await attachUploads(trx, input.attachmentIds, target);
  return toTicket(row, project.key);
}

interface CreateRequest {
  actor: Actor;
  projectKey: string;
  input: CreateTicketValues;
}

interface Repeat {
  project: ProjectRow;
  earlier: TicketRow;
  attachmentIds: readonly string[];
}

// The repeat's text is left alone: the client saves what the person changed with an update, so an
// edit made in between stays. Its files have no other way onto the ticket, being pending uploads.
async function repeatCreate(
  trx: Db,
  ctx: UserContext,
  repeat: Repeat,
): Promise<Outcome<CreatedTicket>> {
  const { project, earlier, attachmentIds } = repeat;
  const later = { ticketId: earlier.id, uploader: ctx.scope };
  const { attached, leftOut } = await attachLaterUploads(trx, later, attachmentIds);
  const updatedAt = attached ? ctx.now() : earlier.updatedAt;
  if (attached) await updateTicketRow(trx, earlier.id, { updatedAt });
  const ticket = toTicket({ ...earlier, updatedAt }, project.key);
  if (leftOut.length === 0) return { ticket, changed: attached };
  return { ticket: { ...ticket, leftOutAttachmentIds: leftOut }, changed: attached };
}

async function createOrRepeat(
  trx: Db,
  ctx: UserContext,
  request: CreateRequest,
): Promise<Outcome<CreatedTicket>> {
  const { actor, projectKey, input } = request;
  const project = await requireProject(trx, ctx.scope, projectKey);
  const earlier = input.clientId
    ? await findTicketByClientId(trx, project.id, input.clientId)
    : undefined;
  if (earlier) {
    return repeatCreate(trx, ctx, { project, earlier, attachmentIds: input.attachmentIds });
  }
  return { ticket: await insertNewTicket(trx, ctx, { actor, project, input }), changed: true };
}

// A create that repeats a client id in the project gets the ticket the first one made, with the
// repeat's files it lacks attached. Looked up inside the transaction: SQLite and PGlite run
// transactions one at a time, so two identical creates at once make one ticket and take one
// number. On Postgres with several connections both can miss it; the unique index refuses the
// second once the first has committed, and the second, rolled back with its number, runs again
// like a later repeat.
export async function createTicket(
  ctx: UserContext,
  actor: Actor,
  projectKey: string,
  input: CreateTicketValues,
): Promise<CreatedTicket> {
  const attempt = () =>
    inTransaction(ctx, (trx) => createOrRepeat(trx, ctx, { actor, projectKey, input }));
  const outcome = await attempt().catch((error: unknown) => {
    if (input.clientId && isUniqueViolation(error)) return attempt();
    throw error;
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

export interface TicketUpdate {
  actor: Actor;
  key: string;
  input: UpdateTicketValues;
  expected?: ExpectedValues | undefined;
}

export async function updateTicket(ctx: UserContext, update: TicketUpdate): Promise<Ticket> {
  const { actor, key, input, expected } = update;
  const outcome = await inTransaction(ctx, async (trx): Promise<Outcome> => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
    const match = expectedMatch(scope.ticket, input, expected);
    const plan = mergeChanges([
      await statusChange(trx, actor, scope, input.statusId),
      fieldChanges(scope.ticket, input, new Date()),
    ]);
    if (isEmpty(plan.changes)) {
      return { ticket: toTicket(scope.ticket, scope.project.key), changed: false };
    }
    const written = await writeTicket(trx, ctx.now, {
      ticket: scope.ticket,
      actor,
      ...plan,
      match,
    });
    return { ticket: toTicket(written.ticket, scope.project.key), changed: true };
  });
  return finish(ctx, outcome);
}

export async function deleteTicket(ctx: UserContext, key: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const ref = await requireTicket(trx, ctx.scope, key);
    const files = await storageKeysOfTicket(trx, ref.ticket.id);
    await deleteTicketRow(trx, ref.ticket.id);
    await updateProjectRow(trx, ref.project.id, { updatedAt: ctx.now() });
    return { ref, files };
  });
  await removeFiles(ctx.storage, removed.files);
  notify(ctx, removed.ref.project.id, removed.ref.ticket.id);
}

export async function moveTicket(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: MoveTicketValues,
): Promise<Ticket> {
  const outcome = await inTransaction(ctx, async (trx): Promise<Outcome> => {
    const scope = await requireTicketScope(trx, ctx.scope, key);
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
