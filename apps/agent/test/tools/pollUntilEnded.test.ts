import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { pollUntilEnded } from '../../src/tools/pollUntilEnded';

const signal = new AbortController().signal;

describe('pollUntilEnded', () => {
  it('asks again while open and returns the end', async () => {
    const waitOnce = vi.fn().mockResolvedValueOnce('open').mockResolvedValueOnce('done');
    const end = await pollUntilEnded({
      waitOnce,
      isOpen: (v) => v === 'open',
      limitMs: 1000,
      signal,
    });
    expect(end).toEqual({ kind: 'ended', value: 'done' });
    expect(waitOnce).toHaveBeenCalledTimes(2);
  });

  it('stops at its own limit, retrying failures on the way', async () => {
    let time = 0;
    const waitOnce = vi.fn(() => {
      time += 400;
      return Promise.reject(new ApiError(503, 'http_error', 'Service Unavailable'));
    });
    const end = await pollUntilEnded({
      waitOnce,
      isOpen: () => true,
      limitMs: 1000,
      signal,
      now: () => time,
      retryDelay: () => 0,
    });
    expect(end).toEqual({ kind: 'timedOut' });
    expect(waitOnce).toHaveBeenCalledTimes(3);
  });

  it('throws a refusal at once, since every later wait would get it too', async () => {
    const waitOnce = vi.fn(() => Promise.reject(new ApiError(403, 'forbidden', 'No.')));
    await expect(
      pollUntilEnded({ waitOnce, isOpen: () => true, limitMs: 1000, signal }),
    ).rejects.toThrow('No.');
    expect(waitOnce).toHaveBeenCalledTimes(1);
  });

  it('ends when its call is aborted', async () => {
    const stop = new AbortController();
    stop.abort();
    const end = await pollUntilEnded({
      waitOnce: vi.fn(),
      isOpen: () => true,
      limitMs: 1000,
      signal: stop.signal,
    });
    expect(end).toEqual({ kind: 'aborted' });
  });
});
