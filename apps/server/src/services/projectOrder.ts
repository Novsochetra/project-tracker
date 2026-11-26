import type { ProjectSummary } from '@tracker/shared';
import type { ProjectRow } from '../db/schema';
import { conflict } from '../errors';
import { listProjectRows, updateProjectRow } from '../repositories/projects';
import { inTransaction, notify, type UserContext } from './context';
import { listProjectSummaries } from './projects';

export const PROJECTS_CHANGED =
  'Your projects changed while you moved this one. Try again with the list as it is now.';

function sameProjects(rows: readonly ProjectRow[], ids: readonly string[]): boolean {
  const known = new Set(rows.map((row) => row.id));
  return (
    ids.length === known.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id))
  );
}

// Positions are written in id order whatever order was sent, so two reorders at once on Postgres
// take the rows' locks in the same order and wait for each other instead of deadlocking.
const byId = (a: [string, number], b: [string, number]) => (a[0] < b[0] ? -1 : 1);

export async function reorderProjects(
  ctx: UserContext,
  ids: readonly string[],
): Promise<ProjectSummary[]> {
  await inTransaction(ctx, async (trx) => {
    const rows = await listProjectRows(trx, ctx.scope);
    if (!sameProjects(rows, ids)) throw conflict(PROJECTS_CHANGED);
    const current = new Map(rows.map((row) => [row.id, row.position]));
    const wanted = ids.map((id, position): [string, number] => [id, position]).sort(byId);
    for (const [id, position] of wanted) {
      if (current.get(id) !== position) await updateProjectRow(trx, id, { position });
    }
  });
  // Every change event refreshes the project list; naming one project keeps the other screens
  // from reading everything again.
  if (ids[0]) notify(ctx, ids[0]);
  return listProjectSummaries(ctx);
}
