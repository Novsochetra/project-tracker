import type { TableRows } from './rows';

// Accounts stay behind, so what moves belongs to the target's owner, or to nobody until owner-set
// makes one, which then gives it to that owner. A source user's id would name no account.
export const givenTo = (rows: TableRows, ownerId: string | null): TableRows => ({
  ...rows,
  projects: rows.projects.map((project) => ({ ...project, ownerId })),
  attachments: rows.attachments.map((attachment) => ({ ...attachment, userId: ownerId })),
});
