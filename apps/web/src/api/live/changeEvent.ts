import type { ChangeEvent } from '@tracker/shared';
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
