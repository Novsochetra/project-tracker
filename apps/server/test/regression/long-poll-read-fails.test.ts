import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBroadcaster } from '../../src/events/broadcaster';
import { longPoll, wakeOn } from '../../src/services/longPoll';

describe('a long poll whose read fails once it listens', () => {
  afterEach(() => vi.useRealTimers());

  it('stops listening and clears its timer instead of waiting out the time', async () => {
    vi.useFakeTimers();
    const changes = createBroadcaster();
    const others = createBroadcaster<string>();
    const signal = new AbortController().signal;
    const removed = vi.spyOn(signal, 'removeEventListener');
    let reads = 0;
    const read = () =>
      ++reads === 1 ? Promise.resolve('open') : Promise.reject(new Error('Database gone'));
    const poll = longPoll({
      read,
      isOpen: (value) => value === 'open',
      wakes: () => [wakeOn(changes, () => true), wakeOn(others, () => true)],
      waitMs: () => 25_000,
      signal,
    });
    await expect(poll).rejects.toThrow('Database gone');
    expect(changes.listenerCount()).toBe(0);
    expect(others.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
