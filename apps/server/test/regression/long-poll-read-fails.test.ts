import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { RunNotice } from '../../src/events/runNotice';
import type { ServiceContext } from '../../src/services/context';
import { longPoll } from '../../src/services/longPoll';

const contextWithEvents = () =>
  ({
    events: createBroadcaster(),
    runEvents: createBroadcaster<RunNotice>(),
    now: () => 0,
  }) as unknown as ServiceContext;

describe('a long poll whose read fails once it listens', () => {
  afterEach(() => vi.useRealTimers());

  it('stops listening and clears its timer instead of waiting out the time', async () => {
    vi.useFakeTimers();
    const ctx = contextWithEvents();
    const signal = new AbortController().signal;
    const removed = vi.spyOn(signal, 'removeEventListener');
    let reads = 0;
    const read = () =>
      ++reads === 1 ? Promise.resolve('open') : Promise.reject(new Error('Database gone'));
    const poll = longPoll(ctx, {
      read,
      isOpen: (value) => value === 'open',
      wakes: () => ({ change: () => true, run: () => true }),
      waitMs: () => 25_000,
      signal,
    });
    await expect(poll).rejects.toThrow('Database gone');
    expect(ctx.events.listenerCount()).toBe(0);
    expect(ctx.runEvents.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
