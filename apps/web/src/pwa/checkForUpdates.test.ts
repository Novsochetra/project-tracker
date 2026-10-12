import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdates, UPDATE_CHECK_MS } from './checkForUpdates';

let stop: () => void = () => undefined;

function start(update = vi.fn(() => Promise.resolve())) {
  stop = checkForUpdates({ update });
  return update;
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('checkForUpdates', () => {
  it('checks every 30 minutes while the app stays open', () => {
    const update = start();
    vi.advanceTimersByTime(UPDATE_CHECK_MS - 1);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(update).toHaveBeenCalledTimes(2);
    expect(UPDATE_CHECK_MS).toBe(30 * 60 * 1000);
  });

  it('checks when the page becomes visible again, not when it is hidden', () => {
    const update = start();
    setVisibility('hidden');
    expect(update).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('ignores a failed check and keeps checking', async () => {
    let checks = 0;
    // A plain function, because vi.fn handles the rejection itself and would hide a missing catch.
    stop = checkForUpdates({
      update: () => {
        checks += 1;
        return Promise.reject(new TypeError('Failed to fetch'));
      },
    });
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
    expect(checks).toBe(2);
  });

  it('stops checking once stopped', () => {
    const update = start();
    stop();
    setVisibility('visible');
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(update).not.toHaveBeenCalled();
  });
});
