import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { AttachmentRow, Database, Db } from '../db/schema';

// A Postgres integer stops at 2^31 - 1 where SQLite's goes on, and a corrupt image can claim up to
// 2^32 - 1 pixels (a 500 on Postgres only). No real image is that large, so it counts as unknown.
const INTEGER_MAX = 2_147_483_647;

export const storableDimension = (value: number | null): number | null =>
  value !== null && value <= INTEGER_MAX ? value : null;

export async function insertAttachment(db: Db, row: AttachmentRow): Promise<void> {
  const width = storableDimension(row.width);
  const height = storableDimension(row.height);
  await db
    .insertInto('attachments')
    .values({ ...row, width, height })
    .execute();
}

export type FinishedUpload = Pick<AttachmentRow, 'size' | 'ticketId' | 'position'>;

export async function finishAttachmentRow(
  db: Db,
  id: string,
  done: FinishedUpload,
): Promise<boolean> {
  const result = await db
    .updateTable('attachments')
    .set(done)
    .where('id', '=', id)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export const findAttachmentById = (db: Db, id: string) =>
  db.selectFrom('attachments').selectAll().where('id', '=', id).executeTakeFirst();

export const listTicketAttachments = (db: Db, ticketId: string) =>
  db
    .selectFrom('attachments')
    .selectAll()
    .where('ticketId', '=', ticketId)
    .orderBy('position')
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export const listActivityAttachments = (db: Db, activityId: string) =>
  db
    .selectFrom('attachments')
    .selectAll()
    .where('activityId', '=', activityId)
    .orderBy('position')
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export async function existingAttachmentIds(db: Db, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .selectFrom('attachments')
    .select('id')
    .where('id', 'in', [...ids])
    .execute();
  return new Set(rows.map((row) => row.id));
}

export async function nextTicketPosition(db: Db, ticketId: string): Promise<number> {
  const row = await db
    .selectFrom('attachments')
    .select((eb) => eb.fn.max('position').as('last'))
    .where('ticketId', '=', ticketId)
    .where('activityId', 'is', null)
    .executeTakeFirst();
  return row?.last === null || row?.last === undefined ? 0 : Number(row.last) + 1;
}

// Files upload side by side and arrive in any order, so their place comes from `ids`, the order
// they were picked in.
export async function linkAttachments(
  db: Db,
  ids: readonly string[],
  target: { ticketId: string; activityId: string | null; uploader: UserScope },
  firstPosition = 0,
): Promise<number> {
  const { ticketId, activityId, uploader } = target;
  const pendingOfUploader = (eb: ExpressionBuilder<Database, 'attachments'>) =>
    eb.and([
      eb('ticketId', 'is', null),
      uploader === null ? eb('userId', 'is', null) : eb('userId', '=', uploader),
    ]);
  let linked = 0;
  for (const [index, id] of ids.entries()) {
    const result = await db
      .updateTable('attachments')
      .set({ ticketId, activityId, position: firstPosition + index })
      .where('id', '=', id)
      .where('activityId', 'is', null)
      .where((eb) => eb.or([pendingOfUploader(eb), eb('ticketId', '=', ticketId)]))
      .executeTakeFirst();
    linked += Number(result.numUpdatedRows);
  }
  return linked;
}

export async function deleteAttachmentRows(db: Db, ids: readonly string[]): Promise<void> {
  if (ids.length > 0)
    await db
      .deleteFrom('attachments')
      .where('id', 'in', [...ids])
      .execute();
}

const storageKeys = (rows: { storageKey: string }[]) => rows.map((row) => row.storageKey);

export const storageKeysOfTicket = async (db: Db, ticketId: string) =>
  storageKeys(
    await db
      .selectFrom('attachments')
      .select('storageKey')
      .where('ticketId', '=', ticketId)
      .execute(),
  );

export const storageKeysOfActivity = async (db: Db, activityId: string) =>
  storageKeys(
    await db
      .selectFrom('attachments')
      .select('storageKey')
      .where('activityId', '=', activityId)
      .execute(),
  );

export const storageKeysOfProject = async (db: Db, projectId: string) =>
  storageKeys(
    await db
      .selectFrom('attachments')
      .innerJoin('tickets', 'tickets.id', 'attachments.ticketId')
      .select('attachments.storageKey')
      .where('tickets.projectId', '=', projectId)
      .execute(),
  );

export const listPendingBefore = (db: Db, before: number) =>
  db
    .selectFrom('attachments')
    .select(['id', 'storageKey'])
    .where('ticketId', 'is', null)
    .where('activityId', 'is', null)
    .where('createdAt', '<', before)
    .execute();

export const assignOwnerlessUploads = (db: Db, userId: string) =>
  db.updateTable('attachments').set({ userId }).where('userId', 'is', null).execute();

export const allStorageKeys = async (db: Db) =>
  storageKeys(await db.selectFrom('attachments').select('storageKey').execute());
