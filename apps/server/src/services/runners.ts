import { RUNNER_REMOVED, type RegisterRunnerInput, type Runner } from '@tracker/shared';
import { inScope, type UserScope } from '../auth/scope';
import { isUniqueViolation } from '../db/errors';
import type { RunnerRow } from '../db/runTables';
import { notFound } from '../errors';
import {
  deleteRunnerRow,
  findRunnerRow,
  insertRunner,
  listRunnerRows,
  updateRunnerRow,
} from '../repositories/runners';
import { failActiveRunsOf } from '../repositories/runs';
import type { ServiceContext } from './context';
import { requireProject } from './lookups';
import { notifyRun, toRunner } from './runMappers';

const RUNNER_NOT_FOUND = 'That computer was not found. Start tracker watch on it again.';

// Another user's helper answers like one that doesn't exist, so nobody learns its id is taken.
export async function requireRunner(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<RunnerRow> {
  const row = await findRunnerRow(ctx.db, id);
  if (!row || !inScope(row.userId, scope)) throw notFound(RUNNER_NOT_FOUND);
  return row;
}

async function projectKeysById(ctx: ServiceContext): Promise<Map<string, string>> {
  const projects = await ctx.db.selectFrom('projects').select(['id', 'key']).execute();
  return new Map(projects.map(({ id, key }) => [id, key]));
}

async function projectIdsOf(ctx: ServiceContext, keys: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const key of keys) ids.push((await requireProject(ctx.db, key)).id);
  return [...new Set(ids)];
}

async function saveRunner(ctx: ServiceContext, row: RunnerRow, retried = false): Promise<void> {
  const existing = await findRunnerRow(ctx.db, row.id);
  if (existing && !inScope(existing.userId, row.userId)) throw notFound(RUNNER_NOT_FOUND);
  const { name, projectIds, lastSeenAt } = row;
  if (existing) return updateRunnerRow(ctx.db, row.id, { name, projectIds, lastSeenAt });
  try {
    await insertRunner(ctx.db, row);
  } catch (error) {
    // Two check-ins with a new id that race: the second becomes an update.
    if (retried || !isUniqueViolation(error)) throw error;
    await saveRunner(ctx, row, true);
  }
}

// A helper checks in with this when it starts and about every 20 s after, which keeps it online.
export async function registerRunner(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: RegisterRunnerInput,
): Promise<Runner> {
  const now = ctx.now();
  const projectIds = await projectIdsOf(ctx, input.projectKeys);
  const row: RunnerRow = {
    id,
    userId: scope,
    name: input.name.trim(),
    projectIds: JSON.stringify(projectIds),
    createdAt: now,
    lastSeenAt: now,
  };
  await saveRunner(ctx, row);
  const saved = await requireRunner(ctx, scope, id);
  return toRunner(saved, await projectKeysById(ctx), now);
}

export async function listRunners(ctx: ServiceContext, scope: UserScope): Promise<Runner[]> {
  const [rows, keys] = await Promise.all([listRunnerRows(ctx.db, scope), projectKeysById(ctx)]);
  const now = ctx.now();
  return rows.map((row) => toRunner(row, keys, now));
}

export async function touchRunner(ctx: ServiceContext, row: RunnerRow): Promise<void> {
  await updateRunnerRow(ctx.db, row.id, { lastSeenAt: ctx.now() });
}

// For a computer the person no longer uses. Its waiting and running runs end, so no phone waits
// on them; a helper stopping on its own is only offline and keeps its runs.
export async function removeRunner(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<void> {
  const row = await requireRunner(ctx, scope, id);
  const ended = await failActiveRunsOf(ctx.db, row.id, RUNNER_REMOVED, ctx.now());
  await deleteRunnerRow(ctx.db, row.id);
  for (const run of ended) notifyRun(ctx, scope, run);
}
