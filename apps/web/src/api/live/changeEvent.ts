import type { ChangeEvent } from '@tracker/shared';
import { isRecord } from '../../lib/isRecord';

const idOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

function parseEvent(data: unknown, type: string): ChangeEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!isRecord(value) || value.type !== type) return null;
    return {
      type: 'changed',
      projectId: idOrNull(value.projectId),
      ticketId: idOrNull(value.ticketId),
    };
  } catch {
    return null;
  }
}

export const parseChangeEvent = (data: unknown): ChangeEvent | null => parseEvent(data, 'changed');

// A run event changes only its ticket's runs, so it is read as a change of that ticket.
export const parseRunChange = (data: unknown): ChangeEvent | null => {
  const event = parseEvent(data, 'run');
  return event?.ticketId ? event : null;
};
