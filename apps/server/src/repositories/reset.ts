import type { Db } from '../db/schema';

// Children first, so foreign keys (including the restricting ticket → status one) never block.
const TABLES_IN_DELETE_ORDER = [
  'pushSubscriptions',
  'runChanges',
  'ticketViewedFiles',
  'runs',
  'runners',
  'apiTokens',
  'sessions',
  'invites',
  'users',
  'attachments',
  'ticketLabels',
  'labels',
  'activities',
  'tickets',
  'statuses',
  'projects',
] as const;

export async function deleteAllRows(db: Db): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) await db.deleteFrom(table).execute();
}
