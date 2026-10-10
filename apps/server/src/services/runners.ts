import {
  ACTIVE_RUN_STATUSES,
  RUNNER_REMOVED,
  type RegisterRunnerInput,
  type Runner,
} from '@tracker/shared';
import { inScope, type UserScope } from '../auth/scope';
import { isUniqueViolation } from '../db/errors';
import type { RunnerRow } from '../db/runTables';
import type { ProjectRow } from '../db/schema';
import { conflict, notFound } from '../errors';
import {
  deleteRunnerRow,
  findRunnerRow,
  insertRunner,
  listRunnerRows,
  updateRunnerRow,
} from '../repositories/runners';
import { failRunsOf } from '../repositories/runs';
import type { ServiceContext } from './context';
import { requireProject } from './lookups';
import { notifyRun, parseProjectIds, toRunner } from './runMappers';

const RUNNER_NOT_FOUND = 'That computer was not found. Start tracker watch on it again.';

// 404 rather than 403, so nobody learns another user's helper exists.
export async function requireRunner(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<RunnerRow> {
  const row = await findRunnerRow(ctx.db, id);
  if (!row || !inScope(row.userId, scope)) throw notFound(RUNNER_NOT_FOUND);
  return row;
}

export async function requireRunnerFor(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  project: Pick<ProjectRow, 'id' | 'key'>,
): Promise<RunnerRow> {
  const runner = await requireRunner(ctx, scope, id);
  if (!parseProjectIds(runner).includes(project.id)) {
    throw conflict(`${runner.name} doesn't run ${project.key}. Start tracker watch there.`);
  }
  return runner;
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
  if (existing)
    return updateRunnerRow(ctx.db, row.userId, row.id, { name, projectIds, lastSeenAt });
  try {
    await insertRunner(ctx.db, row);
  } catch (error) {
    // Two check-ins with a new id that race: the second becomes an update.
    if (retried || !isUniqueViolation(error)) throw error;
    await saveRunner(ctx, row, true);
  }
}

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

export async function touchRunner(
  ctx: ServiceContext,
  scope: UserScope,
  row: RunnerRow,
): Promise<void> {
  await updateRunnerRow(ctx.db, scope, row.id, { lastSeenAt: ctx.now() });
}

// Its runs end so no phone waits on them; a helper that only stops keeps its runs.
export async function removeRunner(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<void> {
  const row = await requireRunner(ctx, scope, id);
  const ended = await failRunsOf(
    ctx.db,
    scope,
    { runnerId: row.id, statuses: ACTIVE_RUN_STATUSES },
    {
      error: RUNNER_REMOVED,
      endedAt: ctx.now(),
    },
  );
  await deleteRunnerRow(ctx.db, scope, row.id);
  for (const run of ended) notifyRun(ctx, scope, run);
}
