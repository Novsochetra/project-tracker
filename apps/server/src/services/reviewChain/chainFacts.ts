import { RUNNER_ONLINE_MS } from '@tracker/shared';
import type { RunnerRow } from '../../db/runTables';
import type { ActivityRow } from '../../db/schema';
import { parseProjectIds } from '../runMappers';

// Events keep no field for a move, so their words tell: "changed status to …" from a status
// change, "… and moved it to …" from a workflow step (ticketCommands, statusMoves, workflow).
const movesStatus = (text: string): boolean =>
  text.startsWith('changed status to ') || text.includes(' and moved it to ');

export const personMovedSince = (activities: readonly ActivityRow[], since: number): boolean =>
  activities.some(
    (row) =>
      row.type === 'event' &&
      row.actorKind === 'human' &&
      row.createdAt >= since &&
      movesStatus(row.text),
  );

export const helperCanTake = (runner: RunnerRow, projectId: string, now: number): boolean =>
  now - runner.lastSeenAt < RUNNER_ONLINE_MS && parseProjectIds(runner).includes(projectId);
