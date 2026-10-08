import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnPreloadError } from '../../src/pwa/reloadOnPreloadError';

// A lazy chunk that fails on every load (gone from the server, blocked by a proxy) reloaded the
// page again and again: Chromium 228 times in 8 s, WebKit 18 (PT-11 review).

let stop: () => void = () => undefined;

// A page load: the listener starts afresh, the tab's session storage stays.
function loadPage(reload: () => void) {
  stop();
  stop = reloadOnPreloadError(reload);
}

const failChunk = () =>
  window.dispatchEvent(
    Object.assign(new Event('vite:preloadError', { cancelable: true }), {
      payload: new TypeError('Failed to fetch dynamically imported module'),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-08T09:00:00Z') });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('regression: a chunk that keeps failing reloads the page once', () => {
  it('stays on the page after one automatic reload, and says why', () => {
    const reload = vi.fn();
    for (let load = 0; load < 5; load += 1) {
      loadPage(reload);
      failChunk();
      vi.advanceTimersByTime(500);
    }
    expect(reload).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.any(String), expect.any(TypeError));
  });

  it('reloads again for a failure well after the last reload, such as the next update', () => {
    const reload = vi.fn();
    loadPage(reload);
    failChunk();
    vi.advanceTimersByTime(30 * 60 * 1000);
    loadPage(reload);
    failChunk();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
