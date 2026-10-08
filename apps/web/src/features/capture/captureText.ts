import { PRIORITIES, type Priority, type Ticket } from '@tracker/shared';

export type CaptureText = Pick<Ticket, 'title' | 'description' | 'priority'>;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);

export function parseCaptureText(value: unknown): CaptureText | undefined {
  if (!isRecord(value)) return undefined;
  const { title, description, priority } = value;
  if (typeof title !== 'string' || typeof description !== 'string' || !isPriority(priority)) {
    return undefined;
  }
  return { title, description, priority };
}
