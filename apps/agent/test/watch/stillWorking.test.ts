import { afterEach, describe, expect, it, vi } from 'vitest';
import { showStillWorking, spanOf } from '../../src/watch/stillWorking';

afterEach(() => vi.useRealTimers());

describe('the sign of life during a run', () => {
  it('says how long it has been', () => {
    expect(spanOf(0)).toBe('0s');
    expect(spanOf(45_000)).toBe('45s');
    expect(spanOf(120_000)).toBe('2m');
    expect(spanOf(150_400)).toBe('2m 30s');
  });

  it('writes a line while the run goes on, and stops when it ends', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const stop = showStillWorking('MOB-1', { log: (text) => log.push(text), every: 1_000 });
    vi.advanceTimersByTime(2_000);
    stop();
    vi.advanceTimersByTime(5_000);
    expect(log).toEqual(['Still working on MOB-1… (1s)', 'Still working on MOB-1… (2s)']);
  });
});
