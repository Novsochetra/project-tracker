import { RUNNER_ONLINE_MS } from '@tracker/shared';
import type { RunnerRow } from '../../db/runTables';
import type { ActivityRow } from '../../db/schema';
import { parseProjectIds } from '../runMappers';
import { isStatusMove } from '../statusEvents';

export const personMovedSince = (activities: readonly ActivityRow[], since: number): boolean =>
  activities.some(
    (row) => row.actorKind === 'human' && row.createdAt >= since && isStatusMove(row),
  );

export const helperCanTake = (runner: RunnerRow, projectId: string, now: number): boolean =>
  now - runner.lastSeenAt < RUNNER_ONLINE_MS && parseProjectIds(runner).includes(projectId);
