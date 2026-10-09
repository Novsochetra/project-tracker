import type { Db } from '../db/schema';
import { idsOf, inChunks, type TableCounts, type TableRows } from './rows';
import { COPIED_TABLE_NAMES, type CopiedTableName } from './tables';

export interface TargetState {
  // Rows the target holds already.
  existing: TableCounts;
  // Of those, rows with an id the move would insert.
  sameIds: TableCounts;
  // Project keys the move would insert that the target uses already (keys are unique).
  sameKeys: string[];
}

export async function countRows(db: Db, name: CopiedTableName): Promise<number> {
  const row = await db
    .selectFrom(name)
    .select((eb) => eb.fn.countAll<number | string>().as('count'))
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function countIds(
  db: Db,
  name: CopiedTableName,
  ids: readonly string[],
): Promise<number> {
  let found = 0;
  for (const chunk of inChunks(ids)) {
    found += (await db.selectFrom(name).select('id').where('id', 'in', chunk).execute()).length;
  }
  return found;
}

async function sameKeys(db: Db, keys: readonly string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = await db.selectFrom('projects').select('key').where('key', 'in', keys).execute();
  return rows.map((row) => row.key);
}

const zeroCounts = (): TableCounts =>
  Object.fromEntries(COPIED_TABLE_NAMES.map((name) => [name, 0])) as TableCounts;

// A target that isn't migrated yet (a dry run before the first deploy) has none of the tables.
export async function readTargetState(db: Db, rows: TableRows): Promise<TargetState> {
  const tables = new Set((await db.introspection.getTables()).map((table) => table.name));
  const state: TargetState = { existing: zeroCounts(), sameIds: zeroCounts(), sameKeys: [] };
  for (const name of COPIED_TABLE_NAMES) {
    if (!tables.has(name)) continue;
    state.existing[name] = await countRows(db, name);
    if (state.existing[name] > 0) state.sameIds[name] = await countIds(db, name, idsOf(rows[name]));
  }
  if (state.existing.projects > 0) {
    state.sameKeys = await sameKeys(
      db,
      rows.projects.map((project) => project.key),
    );
  }
  return state;
}
