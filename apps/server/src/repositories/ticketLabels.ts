import { randomUUID } from 'node:crypto';
import type { UserScope } from '../auth/scope';
import type { Db } from '../db/schema';
import { ownedBy } from './projects';

export type LabelIdsByTicket = ReadonlyMap<string, string[]>;

// In the project's order of labels, numbers first and the id as the tie-break (§2).
const selectTicketLabels = (db: Db) =>
  db
    .selectFrom('ticketLabels')
    .innerJoin('labels', 'labels.id', 'ticketLabels.labelId')
    .select(['ticketLabels.ticketId', 'ticketLabels.labelId'])
    .orderBy('labels.position')
    .orderBy('labels.createdAt')
    .orderBy('labels.id');

function byTicket(rows: readonly { ticketId: string; labelId: string }[]): LabelIdsByTicket {
  const map = new Map<string, string[]>();
  for (const { ticketId, labelId } of rows)
    map.set(ticketId, [...(map.get(ticketId) ?? []), labelId]);
  return map;
}

export const labelIdsInProject = async (db: Db, projectId: string): Promise<LabelIdsByTicket> =>
  byTicket(await selectTicketLabels(db).where('labels.projectId', '=', projectId).execute());

export const labelIdsInScope = async (db: Db, scope: UserScope): Promise<LabelIdsByTicket> =>
  byTicket(
    await selectTicketLabels(db)
      .innerJoin('projects', 'projects.id', 'labels.projectId')
      .where(ownedBy(scope))
      .execute(),
  );

export const labelIdsOfTicket = async (db: Db, ticketId: string): Promise<string[]> =>
  (await selectTicketLabels(db).where('ticketLabels.ticketId', '=', ticketId).execute()).map(
    (row) => row.labelId,
  );

export async function setTicketLabels(
  db: Db,
  ticketId: string,
  labelIds: readonly string[],
  at: number,
): Promise<void> {
  await db.deleteFrom('ticketLabels').where('ticketId', '=', ticketId).execute();
  if (labelIds.length === 0) return;
  const rows = labelIds.map((labelId) => ({ id: randomUUID(), ticketId, labelId, createdAt: at }));
  await db.insertInto('ticketLabels').values(rows).execute();
}
