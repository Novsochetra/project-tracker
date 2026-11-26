import type { Database } from '../db/schema';

export interface CopiedTable {
  name: keyof Database;
  references: readonly (keyof Database)[];
}

// Parents before children, so every foreign key finds its row as it is inserted.
// test/integration/dataMoveSchema checks these references against the migrated schema.
export const COPIED_TABLES = [
  { name: 'projects', references: [] },
  { name: 'statuses', references: ['projects'] },
  { name: 'tickets', references: ['projects', 'statuses'] },
  { name: 'activities', references: ['tickets'] },
  { name: 'attachments', references: ['tickets', 'activities'] },
  { name: 'labels', references: ['projects'] },
  { name: 'ticketLabels', references: ['tickets', 'labels'] },
] as const satisfies readonly CopiedTable[];

export type CopiedTableName = (typeof COPIED_TABLES)[number]['name'];

export const COPIED_TABLE_NAMES: readonly CopiedTableName[] = COPIED_TABLES.map(
  (table) => table.name,
);

// Sign-in belongs to each tracker: the online owner is set there with owner-set (a local tracker
// often has none). The copied projects and files name an owner, which the move sets to the
// target's (owner.ts).
export const SKIPPED_TABLES: Readonly<Record<string, string>> = {
  users: 'the online owner is set with owner-set',
  sessions: "this computer's sign-ins",
  api_tokens: "this computer's agent tokens; make new ones online",
  invites: "this computer's invites; the online owner invites people there",
  questions: 'what agents asked on tickets, each ended within 30 minutes',
  push_subscriptions: "this computer's devices with notifications on; turn them on again online",
  push_keys: "this tracker's own push keys; the online tracker has its own",
};
