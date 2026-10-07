import type { AttachmentRow, Db } from '../db/schema';

export async function insertAttachment(db: Db, row: AttachmentRow): Promise<void> {
  await db.insertInto('attachments').values(row).execute();
}

export const findAttachmentById = (db: Db, id: string) =>
  db.selectFrom('attachments').selectAll().where('id', '=', id).executeTakeFirst();

export const listTicketAttachments = (db: Db, ticketId: string) =>
  db
    .selectFrom('attachments')
    .selectAll()
    .where('ticketId', '=', ticketId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export const listActivityAttachments = (db: Db, activityId: string) =>
  db
    .selectFrom('attachments')
    .selectAll()
    .where('activityId', '=', activityId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export async function linkAttachments(
  db: Db,
  ids: readonly string[],
  target: { ticketId: string; activityId: string | null },
): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await db
    .updateTable('attachments')
    .set(target)
    .where('id', 'in', [...ids])
    .where('activityId', 'is', null)
    .where((eb) => eb.or([eb('ticketId', 'is', null), eb('ticketId', '=', target.ticketId)]))
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
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

export const allStorageKeys = async (db: Db) =>
  storageKeys(await db.selectFrom('attachments').select('storageKey').execute());
