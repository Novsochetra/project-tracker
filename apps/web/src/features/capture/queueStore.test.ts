import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCapture, EMPTY_QUEUE, type QueuedCapture } from './captureQueue';
import {
  QUEUE_STORAGE_KEY,
  readQueue,
  subscribeQueue,
  updateQueue,
  useWaitingCount,
} from './queueStore';

const capture = (id: string): QueuedCapture => ({
  id,
  projectKey: 'MOB',
  title: `Idea ${id}`,
  description: '',
  priority: 'medium',
  capturedAt: 1,
  attempted: false,
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('queue store', () => {
  it('saves the queue in local storage and reads it back', () => {
    expect(updateQueue((queue) => addCapture(queue, capture('a')))).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(QUEUE_STORAGE_KEY) ?? '')).toEqual({
      items: [capture('a')],
      created: [],
    });
    expect(readQueue().items).toEqual([capture('a')]);
  });

  it('reads changes another tab wrote', () => {
    updateQueue((queue) => addCapture(queue, capture('a')));
    const other = { items: [capture('a'), capture('b')], created: [] };
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(other));
    expect(readQueue()).toEqual(other);
  });

  it('reports a write that storage refuses, and keeps the old queue', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(updateQueue((queue) => addCapture(queue, capture('a')))).toBe(false);
    expect(readQueue()).toEqual(EMPTY_QUEUE);
  });

  it('reads as empty when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(readQueue()).toEqual(EMPTY_QUEUE);
  });

  it('tells listeners about its own writes and about other tabs', () => {
    const listener = vi.fn();
    const stop = subscribeQueue(listener);
    updateQueue((queue) => addCapture(queue, capture('a')));
    window.dispatchEvent(new StorageEvent('storage', { key: QUEUE_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something.else' }));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    updateQueue((queue) => addCapture(queue, capture('b')));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('counts the captures waiting to sync', () => {
    const { result } = renderHook(() => useWaitingCount());
    expect(result.current).toBe(0);
    act(() => {
      updateQueue((queue) => addCapture(addCapture(queue, capture('a')), capture('b')));
    });
    expect(result.current).toBe(2);
  });
});
