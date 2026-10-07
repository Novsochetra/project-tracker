import type { ChangeEvent } from '@tracker/shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const idOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

export function parseChangeEvent(data: unknown): ChangeEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!isRecord(value) || value.type !== 'changed') return null;
    return {
      type: 'changed',
      projectId: idOrNull(value.projectId),
      ticketId: idOrNull(value.ticketId),
    };
  } catch {
    return null;
  }
}
