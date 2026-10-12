import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../api/test/deferred';
import { createReachability, type ReachabilityFlag } from './reachability';
import { RECHECK_MS, recheckWhileUnreachable } from './recheck';

let stop: () => void = () => undefined;
let reachability: ReachabilityFlag;
let started: number;
// When each recheck started, in ms since the test began.
let asked: number[];

function watch(recheck: () => Promise<unknown> = () => Promise.resolve()) {
  const ask = vi.fn(() => {
    asked.push(Date.now() - started);
    return recheck();
  });
  stop = recheckWhileUnreachable(reachability, ask);
  return ask;
}

const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
};

const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  started = Date.now();
  asked = [];
  reachability = createReachability().banner;
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('recheckWhileUnreachable', () => {
  it('asks nothing while the tracker answers', async () => {
    const ask = watch();
    await wait(30_000);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks again soon after the tracker is lost, backing off to every RECHECK_MAX_MS', async () => {
    watch();
    reachability.setUnreachable(true);

    await wait(12_000);

    expect(asked).toEqual([1_000, 3_000, 6_000, 9_000, 12_000]);
  });

  it('asks soon when it starts while the tracker is already lost', async () => {
    reachability.setUnreachable(true);
    watch();

    await wait(3_000);

    expect(asked).toEqual([1_000, 3_000]);
  });

  it('stops once the tracker answers, and starts over when it is lost again', async () => {
    watch();
    reachability.setUnreachable(true);
    await wait(3_000);
    expect(asked).toEqual([1_000, 3_000]);

    reachability.setUnreachable(false);
    await wait(30_000);
    expect(asked).toEqual([1_000, 3_000]);

    reachability.setUnreachable(true);
    await wait(RECHECK_MS);
    expect(asked).toEqual([1_000, 3_000, 34_000]);
  });

  it('waits for the recheck on its way before the next wait starts', async () => {
    const answer = deferred<void>();
    const ask = watch(() => answer.promise);
    reachability.setUnreachable(true);

    await wait(20_000);
    expect(ask).toHaveBeenCalledTimes(1);

    answer.resolve();
    await wait(2 * RECHECK_MS);
    expect(asked).toEqual([1_000, 22_000]);
  });

  it('asks nothing while the page is hidden, and asks at once when it is seen again', async () => {
    watch();
    setVisibility('hidden');
    reachability.setUnreachable(true);
    await wait(30_000);
    expect(asked).toEqual([]);

    setVisibility('visible');
    await wait(0);
    expect(asked).toEqual([30_000]);

    await wait(RECHECK_MS);
    expect(asked).toEqual([30_000, 31_000]);
  });

  it('asks at once when the browser says it is online again', async () => {
    watch();
    reachability.setUnreachable(true);
    await wait(20_000);
    const before = asked.length;

    window.dispatchEvent(new Event('online'));
    await wait(0);

    expect(asked).toHaveLength(before + 1);
    expect(asked.at(-1)).toBe(20_000);
  });

  it('stops asking when the page is hidden', async () => {
    watch();
    reachability.setUnreachable(true);
    await wait(1_000);
    setVisibility('hidden');
    await wait(30_000);
    expect(asked).toEqual([1_000]);
  });

  it('sends no second recheck when the page is seen again while one is on its way', async () => {
    const answer = deferred<void>();
    const ask = watch(() => answer.promise);
    reachability.setUnreachable(true);
    await wait(1_000);

    setVisibility('hidden');
    setVisibility('visible');
    await wait(0);

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks nothing once stopped, also after a recheck that ends later', async () => {
    const answer = deferred<void>();
    const ask = watch(() => answer.promise);
    reachability.setUnreachable(true);
    await wait(1_000);

    stop();
    answer.resolve();
    setVisibility('visible');
    window.dispatchEvent(new Event('online'));
    await wait(30_000);

    expect(ask).toHaveBeenCalledTimes(1);
  });
});
