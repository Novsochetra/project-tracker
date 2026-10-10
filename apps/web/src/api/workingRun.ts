import { ACTIVE_RUN_STATUSES, type Run } from '@tracker/shared';

// The tracker ends a run whose helper went silent only when it is asked about runs.
export const WORKING_RUN_REFRESH_MS = 30_000;

export const isWorking = (run: Run): boolean =>
  ACTIVE_RUN_STATUSES.some((status) => status === run.status);

export function workingRun(runs: readonly Run[] | undefined): Run | undefined {
  const latest = runs?.[0];
  return latest && isWorking(latest) ? latest : undefined;
}

export const runsRefreshMs = (runs: readonly Run[] | undefined): number | false =>
  workingRun(runs) ? WORKING_RUN_REFRESH_MS : false;
