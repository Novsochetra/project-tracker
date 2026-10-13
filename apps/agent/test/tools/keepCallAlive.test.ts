import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepCallAlive, PROGRESS_MS } from '../../src/tools/keepCallAlive';

afterEach(() => {
  vi.useRealTimers();
});

describe('keepCallAlive', () => {
  it('sends progress on the call while it waits, and stops', () => {
    vi.useFakeTimers();
    const send = vi.fn(() => Promise.resolve());
    const stop = keepCallAlive('p-7', send);
    vi.advanceTimersByTime(PROGRESS_MS * 2);
    stop();
    vi.advanceTimersByTime(PROGRESS_MS * 2);
    expect(send.mock.calls).toEqual([
      [{ method: 'notifications/progress', params: { progressToken: 'p-7', progress: 1 } }],
      [{ method: 'notifications/progress', params: { progressToken: 'p-7', progress: 2 } }],
    ]);
    expect(PROGRESS_MS).toBeLessThan(30_000);
  });

  it('sends nothing for a call without a progress token, and survives a failed send', () => {
    vi.useFakeTimers();
    const send = vi.fn(() => Promise.reject(new Error('closed')));
    keepCallAlive(undefined, send)();
    const stop = keepCallAlive(3, send);
    vi.advanceTimersByTime(PROGRESS_MS);
    stop();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
