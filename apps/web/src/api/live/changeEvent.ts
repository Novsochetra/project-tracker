import { RUN_STATUSES, type ChangeEvent, type RunEvent } from '@tracker/shared';
import { isRecord } from '../../lib/isRecord';

const idOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

function readJson(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseChangeEvent(data: unknown): ChangeEvent | null {
  const value = readJson(data);
  if (value?.type !== 'changed') return null;
  return {
    type: 'changed',
    projectId: idOrNull(value.projectId),
    ticketId: idOrNull(value.ticketId),
  };
}

// A run works on a ticket or answers in a chat, so it names one of them.
export function parseRunEvent(data: unknown): RunEvent | null {
  const value = readJson(data);
  const status = RUN_STATUSES.find((known) => known === value?.status);
  const runId = idOrNull(value?.runId);
  const projectId = idOrNull(value?.projectId);
  const ticketId = idOrNull(value?.ticketId);
  const chatId = idOrNull(value?.chatId);
  if (value?.type !== 'run' || !status || !runId || !projectId) return null;
  if (!ticketId && !chatId) return null;
  const runnerId = idOrNull(value.runnerId);
  return { type: 'run', runId, runnerId, projectId, ticketId, chatId, status };
}
