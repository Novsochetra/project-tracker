import {
  formatTicketKey,
  RUNNER_ONLINE_MS,
  type AskOptions,
  type Run,
  type Runner,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunnerRow, RunRow } from '../db/runTables';
import type { RunWithKey } from '../repositories/runs';
import type { ServiceContext } from './context';

const askOptionsOf = ({ askModel, askMode }: RunRow): AskOptions | null =>
  askModel && askMode ? { model: askModel, mode: askMode } : null;

export const toRun = (row: RunWithKey): Run => ({
  id: row.id,
  kind: row.kind,
  projectKey: row.projectKey,
  ticketKey: row.ticketNum === null ? null : formatTicketKey(row.projectKey, row.ticketNum),
  chatId: row.chatId,
  askOptions: askOptionsOf(row),
  runnerId: row.runnerId,
  runnerName: row.runnerName,
  status: row.status,
  error: row.error,
  createdAt: row.createdAt,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
});

export function parseProjectIds(row: RunnerRow): string[] {
  try {
    const ids: unknown = JSON.parse(row.projectIds);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function toRunner(
  row: RunnerRow,
  keysById: ReadonlyMap<string, string>,
  now: number,
): Runner {
  const projectKeys = parseProjectIds(row).flatMap((id) => {
    const key = keysById.get(id);
    return key ? [key] : [];
  });
  return {
    id: row.id,
    name: row.name,
    projectKeys,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    online: now - row.lastSeenAt < RUNNER_ONLINE_MS,
  };
}

export function notifyRun(ctx: ServiceContext, userId: UserScope, row: RunRow): void {
  ctx.runEvents.publish({
    userId,
    event: {
      type: 'run',
      runId: row.id,
      runnerId: row.runnerId,
      projectId: row.projectId,
      ticketId: row.ticketId,
      chatId: row.chatId,
      status: row.status,
    },
  });
}
