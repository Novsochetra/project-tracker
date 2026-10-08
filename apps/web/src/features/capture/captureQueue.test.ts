import { describe, expect, it } from 'vitest';
import {
  addCapture,
  dropCapture,
  EMPTY_QUEUE,
  findWaiting,
  markAttempted,
  markCreated,
  nextCapture,
  parseQueue,
  waitingCaptures,
  waitingCount,
  type QueuedCapture,
} from './captureQueue';

const capture = (id: string, capturedAt: number, overrides: Partial<QueuedCapture> = {}) => ({
  id,
  projectKey: 'MOB',
  title: `Idea ${id}`,
  description: '',
  priority: 'medium' as const,
  capturedAt,
  attempted: false,
  ...overrides,
});

const NONE = new Set<string>();

describe('capture queue', () => {
  it('adds captures and counts them as waiting', () => {
    const queue = addCapture(addCapture(EMPTY_QUEUE, capture('a', 1)), capture('b', 2));
    expect(waitingCaptures(queue).map(({ id }) => id)).toEqual(['a', 'b']);
    expect(waitingCount(queue)).toBe(2);
  });

  it('keeps one copy of a capture, and never takes back one already created', () => {
    const once = addCapture(EMPTY_QUEUE, capture('a', 1));
    expect(addCapture(once, capture('a', 1))).toBe(once);
    const created = markCreated(once, 'a');
    expect(addCapture(created, capture('a', 1))).toBe(created);
    expect(waitingCount(created)).toBe(0);
  });

  it('sends the oldest capture first, whatever order they were stored in', () => {
    const queue = {
      items: [capture('late', 30), capture('early', 10), capture('mid', 20)],
      created: [],
    };
    expect(nextCapture(queue, NONE)?.id).toBe('early');
    expect(nextCapture(queue, new Set(['early']))?.id).toBe('mid');
  });

  it('skips a stale copy of a capture that was already created', () => {
    const queue = { items: [capture('a', 1), capture('b', 2)], created: ['a'] };
    expect(nextCapture(queue, NONE)?.id).toBe('b');
    expect(waitingCount(queue)).toBe(1);
  });

  it('finds a capture by id only while it still waits', () => {
    const queue = {
      items: [capture('a', 1), capture('b', 2, { attempted: true })],
      created: ['a'],
    };
    expect(findWaiting(queue, 'b')).toEqual(capture('b', 2, { attempted: true }));
    expect(findWaiting(queue, 'a')).toBeUndefined();
    expect(findWaiting(queue, 'gone')).toBeUndefined();
  });

  it('marks a capture as attempted without touching the others', () => {
    const queue = markAttempted({ items: [capture('a', 1), capture('b', 2)], created: [] }, 'b');
    expect(queue.items.map(({ attempted }) => attempted)).toEqual([false, true]);
  });

  it('remembers created ids, keeping only the most recent ones', () => {
    let queue = EMPTY_QUEUE;
    for (let index = 0; index < 60; index += 1) {
      queue = markCreated(addCapture(queue, capture(`c${index}`, index)), `c${index}`);
    }
    expect(queue.items).toEqual([]);
    expect(queue.created).toHaveLength(50);
    expect(queue.created[0]).toBe('c10');
    expect(queue.created.at(-1)).toBe('c59');
  });

  it('drops a capture without remembering it as created', () => {
    const queue = dropCapture({ items: [capture('a', 1)], created: [] }, 'a');
    expect(queue).toEqual(EMPTY_QUEUE);
  });
});

describe('parseQueue', () => {
  it('reads what was stored', () => {
    const stored = { items: [capture('a', 1, { attempted: true })], created: ['z'] };
    expect(parseQueue(JSON.stringify(stored))).toEqual(stored);
  });

  it('starts empty from nothing, broken text or the wrong shape', () => {
    expect(parseQueue(null)).toEqual(EMPTY_QUEUE);
    expect(parseQueue('{not json')).toEqual(EMPTY_QUEUE);
    expect(parseQueue('[1, 2]')).toEqual(EMPTY_QUEUE);
    expect(parseQueue('"text"')).toEqual(EMPTY_QUEUE);
  });

  it('keeps every readable capture and fills in what is missing', () => {
    const text = JSON.stringify({
      items: [
        { id: 'a', projectKey: 'MOB', title: 'Kept', priority: 'urgent' },
        { id: 'b', title: 'No project' },
        'junk',
      ],
      created: ['x', 7],
    });
    expect(parseQueue(text)).toEqual({
      items: [capture('a', 0, { title: 'Kept' })],
      created: ['x'],
    });
  });
});
