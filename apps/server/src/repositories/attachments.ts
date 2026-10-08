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
  target: { ticketId: string; activityId: string | null },
): Promise<number> {
  let linked = 0;
  for (const [position, id] of ids.entries()) {
    const result = await db
      .updateTable('attachments')
      .set({ ...target, position })
      .where('id', '=', id)
      .where('activityId', 'is', null)
      .where((eb) => eb.or([eb('ticketId', 'is', null), eb('ticketId', '=', target.ticketId)]))
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

export const allStorageKeys = async (db: Db) =>
  storageKeys(await db.selectFrom('attachments').select('storageKey').execute());
