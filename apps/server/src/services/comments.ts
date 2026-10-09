import type {
  Activity,
  ActivityType,
  Actor,
  createCommentInput,
  updateCommentRequest,
} from '@tracker/shared';
import type { z } from 'zod';
import type { ActivityRow, Db } from '../db/schema';
import { conflict, notFound, staleEdit } from '../errors';
import {
  deleteActivityRow,
  findActivityById,
  updateActivityMatching,
  updateActivityRow,
} from '../repositories/activities';
import { listActivityAttachments, storageKeysOfActivity } from '../repositories/attachments';
import { updateTicketRow } from '../repositories/tickets';
import { removeFiles } from '../storage/fileStorage';
import { attachUploads } from './attachmentLinks';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireTicket, requireTicketById, type TicketRef } from './lookups';
import { toActivity } from './mappers';
import { writeTicket } from './ticketWrites';

type CommentValues = z.output<typeof createCommentInput>;
type CommentEdit = z.output<typeof updateCommentRequest>;
type Edit = Pick<ActivityRow, 'text' | 'editedAt'>;

const DELETABLE: ReadonlySet<ActivityType> = new Set(['comment', 'report', 'review']);

interface ActivityOutcome {
  ref: TicketRef;
  activity: Activity;
}

function finish(ctx: ServiceContext, outcome: ActivityOutcome): Activity {
  notify(ctx, outcome.ref.project.id, outcome.ref.ticket.id);
  return outcome.activity;
}

async function requireActivity(db: Db, id: string) {
  const activity = await findActivityById(db, id);
  if (!activity) throw notFound('That activity item was not found.');
  return activity;
}

export async function addComment(
  ctx: ServiceContext,
  actor: Actor,
  key: string,
  input: CommentValues,
): Promise<Activity> {
  const outcome = await inTransaction(ctx, async (trx) => {
    const ref = await requireTicket(trx, key);
    const written = await writeTicket(trx, ctx.now, {
      ticket: ref.ticket,
      actor,
      entries: [{ type: 'comment', text: input.text.trim() }],
    });
    const [row] = written.activities;
    if (!row) throw new Error('The comment was not written.');
    await attachUploads(trx, input.attachmentIds, { ticketId: ref.ticket.id, activityId: row.id });
    return { ref, activity: toActivity(row, await listActivityAttachments(trx, row.id)) };
  });
  return finish(ctx, outcome);
}

const staleComment = () =>
  staleEdit('The comment changed since this edit was typed. Read it again first.');

// An edit that names the text it was typed over is refused once the comment has other text, also
// when it would change nothing, so an older edit that lands late can't overwrite a newer one.
async function writeEdit(db: Db, row: ActivityRow, edit: Edit, expected: string | undefined) {
  if (expected === undefined) return updateActivityRow(db, row.id, edit);
  if (row.text !== expected) throw staleComment();
  if (!(await updateActivityMatching(db, row.id, expected, edit))) throw staleComment();
}

export async function updateComment(
  ctx: ServiceContext,
  id: string,
  input: CommentEdit,
): Promise<Activity> {
  const outcome = await inTransaction(ctx, async (trx) => {
    const row = await requireActivity(trx, id);
    if (row.type !== 'comment') throw conflict('Only comments can be edited.');
    const edit = { text: input.text, editedAt: ctx.now() };
    await writeEdit(trx, row, edit, input.expected?.text);
    await updateTicketRow(trx, row.ticketId, { updatedAt: edit.editedAt });
    const activity = toActivity({ ...row, ...edit }, await listActivityAttachments(trx, id));
    return { ref: await requireTicketById(trx, row.ticketId), activity };
  });
  return finish(ctx, outcome);
}

export async function deleteActivity(ctx: ServiceContext, id: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const row = await requireActivity(trx, id);
    if (!DELETABLE.has(row.type)) throw conflict('Events cannot be deleted.');
    const files = await storageKeysOfActivity(trx, id);
    await deleteActivityRow(trx, id);
    await updateTicketRow(trx, row.ticketId, { updatedAt: ctx.now() });
    return { ref: await requireTicketById(trx, row.ticketId), files };
  });
  await removeFiles(ctx.storage, removed.files);
  notify(ctx, removed.ref.project.id, removed.ref.ticket.id);
}
