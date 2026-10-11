import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetReload, RELOAD_ON_ITS_WAY_MS, reloadPage, reloadTimeLeft } from './pageReload';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  forgetReload();
  vi.useRealTimers();
});

describe('reloadPage', () => {
  it('reloads, and counts the reload as on its way until its time is up', () => {
    const reload = vi.fn();
    expect(reloadTimeLeft()).toBe(0);
    reloadPage(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadTimeLeft()).toBe(RELOAD_ON_ITS_WAY_MS);
    vi.advanceTimersByTime(RELOAD_ON_ITS_WAY_MS - 1);
    expect(reloadTimeLeft()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(reloadTimeLeft()).toBe(0);
  });

  it('counts a later reload from when it is asked for', () => {
    reloadPage(vi.fn());
    vi.advanceTimersByTime(RELOAD_ON_ITS_WAY_MS);
    reloadPage(vi.fn());
    expect(reloadTimeLeft()).toBe(RELOAD_ON_ITS_WAY_MS);
  });

  it('keeps its time when the wall clock steps back', () => {
    reloadPage(vi.fn());
    vi.setSystemTime(Date.now() - 60_000);
    expect(reloadTimeLeft()).toBe(RELOAD_ON_ITS_WAY_MS);
  });
});

describe('forgetReload', () => {
  it('ends the wait for a reload the browser cancelled', () => {
    reloadPage(vi.fn());
    forgetReload();
    expect(reloadTimeLeft()).toBe(0);
  });
});
