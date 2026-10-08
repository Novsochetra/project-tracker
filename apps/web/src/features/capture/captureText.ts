import { isPriority, type Ticket } from '@tracker/shared';
import { isRecord } from '../../lib/isRecord';

export type CaptureText = Pick<Ticket, 'title' | 'description' | 'priority'>;

export function parseCaptureText(value: unknown): CaptureText | undefined {
  if (!isRecord(value)) return undefined;
  const { title, description, priority } = value;
  if (typeof title !== 'string' || typeof description !== 'string' || !isPriority(priority)) {
    return undefined;
  }
  return { title, description, priority };
}
