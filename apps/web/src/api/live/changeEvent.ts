import type { ChangeEvent } from '@tracker/shared';
import { isRecord } from '../../lib/isRecord';

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
