import { PRIORITIES, type Priority } from '@tracker/shared';

export interface QueuedCapture {
  // Client id, sent with every request for the capture: the tracker makes one ticket per id, so
  // sending it again is harmless. Once the ticket exists, the capture is never sent again.
  id: string;
  projectKey: string;
  title: string;
  description: string;
  priority: Priority;
  capturedAt: number;
}

export interface CaptureQueue {
  items: readonly QueuedCapture[];
  // Ids already created, so a stale copy of a capture is skipped instead of sent twice.
  created: readonly string[];
}

export const EMPTY_QUEUE: CaptureQueue = { items: [], created: [] };

const CREATED_MEMORY = 50;

const isKnown = (queue: CaptureQueue, id: string): boolean =>
  queue.created.includes(id) || queue.items.some((item) => item.id === id);

export function addCapture(queue: CaptureQueue, capture: QueuedCapture): CaptureQueue {
  return isKnown(queue, capture.id) ? queue : { ...queue, items: [...queue.items, capture] };
}

export function waitingCaptures(queue: CaptureQueue): QueuedCapture[] {
  return queue.items
    .filter((item) => !queue.created.includes(item.id))
    .sort((a, b) => a.capturedAt - b.capturedAt);
}

export const waitingCount = (queue: CaptureQueue): number => waitingCaptures(queue).length;

export const nextCapture = (
  queue: CaptureQueue,
  skip: ReadonlySet<string>,
): QueuedCapture | undefined => waitingCaptures(queue).find((item) => !skip.has(item.id));

export const findWaiting = (queue: CaptureQueue, id: string): QueuedCapture | undefined =>
  queue.created.includes(id) ? undefined : queue.items.find((item) => item.id === id);

export function markCreated(queue: CaptureQueue, id: string): CaptureQueue {
  const created = queue.created.includes(id) ? queue.created : [...queue.created, id];
  return {
    items: queue.items.filter((item) => item.id !== id),
    created: created.slice(-CREATED_MEMORY),
  };
}

export function dropCapture(queue: CaptureQueue, id: string): CaptureQueue {
  return { ...queue, items: queue.items.filter((item) => item.id !== id) };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);

function toCapture(value: unknown): QueuedCapture[] {
  if (!isRecord(value)) return [];
  const { id, projectKey, title, description, priority, capturedAt } = value;
  if (typeof id !== 'string' || typeof projectKey !== 'string' || typeof title !== 'string') {
    return [];
  }
  return [
    {
      id,
      projectKey,
      title,
      description: typeof description === 'string' ? description : '',
      priority: isPriority(priority) ? priority : 'medium',
      capturedAt: typeof capturedAt === 'number' ? capturedAt : 0,
    },
  ];
}

export function parseQueue(text: string | null): CaptureQueue {
  if (!text) return EMPTY_QUEUE;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return EMPTY_QUEUE;
  }
  if (!isRecord(value)) return EMPTY_QUEUE;
  const items = Array.isArray(value.items) ? value.items.flatMap(toCapture) : [];
  const created = Array.isArray(value.created)
    ? value.created.filter((id): id is string => typeof id === 'string')
    : [];
  return { items, created };
}
