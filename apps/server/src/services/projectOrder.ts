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

// Every position is written, in id order whatever order was sent: two reorders at once on Postgres
// then take the rows' locks in the same order, so the second waits for the first and writes its
// whole order over it, instead of deadlocking or skipping rows it read before the first committed
// and ending in an order neither asked for. SQLite runs one write transaction at a time.
const byId = (a: [string, number], b: [string, number]) => (a[0] < b[0] ? -1 : 1);

export async function reorderProjects(
  ctx: UserContext,
  ids: readonly string[],
): Promise<ProjectSummary[]> {
  await inTransaction(ctx, async (trx) => {
    const rows = await listProjectRows(trx, ctx.scope);
    if (!sameProjects(rows, ids)) throw conflict(PROJECTS_CHANGED);
    const wanted = ids.map((id, position): [string, number] => [id, position]).sort(byId);
    for (const [id, position] of wanted) await updateProjectRow(trx, id, { position });
  });
  // Every change event refreshes the project list; naming one project keeps the other screens
  // from reading everything again.
  if (ids[0]) notify(ctx, ids[0]);

  return listProjectSummaries(ctx);
}
