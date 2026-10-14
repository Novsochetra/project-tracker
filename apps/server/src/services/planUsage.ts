import { planLimitsInput, type HelperPlanUsage, type PlanLimitsInput } from '@tracker/shared';
import { z } from 'zod';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { listRunnerRows, updateRunnerRow } from '../repositories/runners';
import type { ServiceContext } from './context';

const storedPlanLimits = z.object({ limits: planLimitsInput, seenAt: z.number().int().min(0) });

function parsePlanLimits({ planLimits }: Pick<RunnerRow, 'planLimits'>) {
  if (planLimits === null) return null;
  try {
    return storedPlanLimits.safeParse(JSON.parse(planLimits)).data ?? null;
  } catch {
    return null;
  }
}

const toPlanUsage = (row: RunnerRow): HelperPlanUsage => {
  const stored = parsePlanLimits(row);
  return {
    runnerId: row.id,
    runnerName: row.name,
    limits: stored?.limits ?? null,
    seenAt: stored?.seenAt ?? null,
  };
};

export interface SeenPlanLimits {
  runnerId: string | null;
  limits: PlanLimitsInput | undefined;
  // The tracker's own clock, since the helper's may be off.
  seenAt: number;
}

export async function notePlanLimits(
  db: Db,
  scope: UserScope,
  { runnerId, limits, seenAt }: SeenPlanLimits,
): Promise<void> {
  if (!runnerId || !limits) return;
  const planLimits = JSON.stringify(storedPlanLimits.parse({ limits, seenAt }));
  await updateRunnerRow(db, scope, runnerId, { planLimits });
}

export async function listPlanUsage(ctx: ServiceContext, scope: UserScope) {
  return (await listRunnerRows(ctx.db, scope)).map(toPlanUsage);
}
