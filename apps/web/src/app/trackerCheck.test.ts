import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../api/test/deferred';
import { CHECK_TIMEOUT_MS, sharedCheck, trackerCheckOf } from './trackerCheck';

const NETWORK_DOWN = new TypeError('Failed to fetch');
const BARE_502 = new ApiError(502, 'http_error', 'Bad Gateway');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sharedCheck', () => {
  it.each([
    ['an answer', () => Promise.resolve({ ok: true }), 'reachable'],
    [
      'an error the tracker answered with',
      () => Promise.reject(new ApiError(500, 'x', 'y')),
      'reachable',
    ],
    ['a bare 5xx: a proxy for a stopped API', () => Promise.reject(BARE_502), 'unreachable'],
    ['no answer', () => Promise.reject(NETWORK_DOWN), 'unreachable'],
    ['a failure that says nothing', () => Promise.reject(new SyntaxError('x')), null],
  ])('reads %s as %s', async (_name, read, signal) => {
    await expect(sharedCheck(read)()).resolves.toBe(signal);
  });

  it('sends one read for the checks asked for while it is on its way', async () => {
    const answer = deferred<unknown>();
    const read = vi.fn(() => answer.promise);
    const check = sharedCheck(read);

    const first = check();
    const second = check();
    answer.resolve({ ok: true });

    await expect(Promise.all([first, second])).resolves.toEqual(['reachable', 'reachable']);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('sends a new read for a check asked for after the last one ended', async () => {
    const read = vi.fn(() => Promise.resolve({ ok: true }));
    const check = sharedCheck(read);

    await check();
    await check();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('counts a read with no answer after CHECK_TIMEOUT_MS as unreachable, and stops it', async () => {
    const read = vi.fn((_signal: AbortSignal) => new Promise<never>(() => undefined));
    const done = vi.fn();
    void sharedCheck(read)().then(done);

    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS - 1);
    expect(done).not.toHaveBeenCalled();
    expect(read.mock.calls[0]![0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(done).toHaveBeenCalledWith('unreachable');
    expect(read.mock.calls[0]![0].aborted).toBe(true);
  });

  it('takes the time out over the AbortError of a read that stops at once', async () => {
    const read = (signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
      );
    const result = sharedCheck(read)();

    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS);

    await expect(result).resolves.toBe('unreachable');
  });
});

describe('trackerCheckOf', () => {
  it("shares one check among all the watchers of a tracker's requests", async () => {
    const answer = deferred<unknown>();
    const client = { checkHealth: vi.fn(() => answer.promise as Promise<{ ok: boolean }>) };

    const checks = [trackerCheckOf(client)(), trackerCheckOf(client)()];
    answer.resolve({ ok: true });

    await expect(Promise.all(checks)).resolves.toEqual(['reachable', 'reachable']);
    expect(trackerCheckOf(client)).toBe(trackerCheckOf(client));
    expect(client.checkHealth).toHaveBeenCalledTimes(1);
    expect(client.checkHealth).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });
});
