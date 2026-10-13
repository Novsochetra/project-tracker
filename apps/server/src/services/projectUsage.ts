import { USAGE_DAYS, type ProjectUsage } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { projectUsageSince } from '../repositories/runUsage';
import type { ServiceContext } from './context';
import { requireProject } from './lookups';

const DAY_MS = 24 * 60 * 60 * 1000;

// Postgres sums a bigint as numeric, which arrives as text.
const sumOf = (value: string | number | bigint | null): number | null =>
  value === null ? null : Number(value);

export async function getProjectUsage(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
): Promise<ProjectUsage> {
  const project = await requireProject(ctx.db, scope, projectKey);
  const since = ctx.now() - USAGE_DAYS * DAY_MS;
  const row = await projectUsageSince(ctx.db, scope, project.id, since);
  return {
    days: USAGE_DAYS,
    runs: Number(row.runs),
    costMicros: sumOf(row.costMicros),
    turns: sumOf(row.turns),
    durationMs: sumOf(row.durationMs),
  };
}
