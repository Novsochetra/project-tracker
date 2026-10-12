import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkForUpdates, UPDATE_CHECK_MS } from '../../src/pwa/checkForUpdates';

// In the iOS Simulator, WebKit kept navigator.onLine false for 20 minutes after the Mac's network
// came back while every request was answered, and the app skipped every check for a new build
// (PT-179).

let stop: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('looks for a new build while the browser says it is offline', () => {
  const update = vi.fn(() => Promise.resolve());
  stop = checkForUpdates({ update });

  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(update).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(UPDATE_CHECK_MS);
  expect(update).toHaveBeenCalledTimes(2);
});
