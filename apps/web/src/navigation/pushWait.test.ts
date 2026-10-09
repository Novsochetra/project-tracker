import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitAtMost } from './pushWait';

const LIMIT = 1_000;

function tracked(promise: Promise<void>) {
  let done = false;
  void promise.then(() => (done = true));
  return () => done;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('waitAtMost', () => {
  it('settles when the code comes in time, and leaves no timer behind', async () => {
    let arrive = () => undefined as void;
    const done = tracked(waitAtMost(new Promise<void>((resolve) => (arrive = resolve)), LIMIT));
    await vi.advanceTimersByTimeAsync(LIMIT / 2);
    expect(done()).toBe(false);

    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(done()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles at the limit when the code never comes', async () => {
    const done = tracked(waitAtMost(new Promise<void>(() => undefined), LIMIT));
    await vi.advanceTimersByTimeAsync(LIMIT - 1);
    expect(done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done()).toBe(true);
  });

  it('settles when the code fails, without passing the failure on', async () => {
    const done = tracked(waitAtMost(Promise.reject(new Error('404')), LIMIT));
    await vi.advanceTimersByTimeAsync(0);
    expect(done()).toBe(true);
  });
});
