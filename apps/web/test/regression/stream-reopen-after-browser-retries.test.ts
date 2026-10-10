import { LIVE_STALE_MS } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_RETRY_MS, retryDelay } from '../../src/api/live/backoff';
import { connectLiveUpdates, LIVE_WAIT_ATTEMPTS } from '../../src/api/live/eventStream';
import { MockEventSource } from '../../src/api/test/mockEventSource';

// PT-97: since PT-82 every error the browser reports while it retries a dropped stream counted as
// one of the app's own failed reopenings too. In an outage longer than the 35 s silence check the
// app then closed the stream and waited 15 s before its first try (Chromium: no tries from 32.8 s
// to 50.4 s), where it waited 1 s before, and the first reopen after a 502 waited 2 s, not 1 s.
// The browser's tries still count toward the few after which focus reads stop waiting.

// About a browser's own wait between tries of a dropped EventSource.
const BROWSER_RETRY_MS = 3_000;

let stop: (() => void) | undefined;

function connect() {
  const handlers = {
    onChange: vi.fn(),
    onRun: vi.fn(),
    onRunStep: vi.fn(),
    onReconnect: vi.fn(),
    onRefreshPending: vi.fn(),
    onRefused: vi.fn(),
  };
  stop = connectLiveUpdates('/api/events', handlers);
  MockEventSource.latest().open();
  return handlers;
}

const STEP_MS = 100;

// The time from now until the app opens a new EventSource.
function waitForReopen(): number {
  const count = MockEventSource.instances.length;
  let waited = 0;
  while (MockEventSource.instances.length === count && waited < LIVE_STALE_MS * 2) {
    vi.advanceTimersByTime(STEP_MS);
    waited += STEP_MS;
  }
  return waited;
}

// The network is gone: the browser tries the dropped stream every few seconds and each try fails,
// until the silence check closes it.
function outageUntilSilenceCheck() {
  const source = MockEventSource.latest();
  let sinceTry = 0;
  source.fail(false);
  while (source.readyState !== MockEventSource.CLOSED) {
    vi.advanceTimersByTime(STEP_MS);
    sinceTry += STEP_MS;
    if (sinceTry < BROWSER_RETRY_MS || source.readyState === MockEventSource.CLOSED) continue;
    source.fail(false);
    sinceTry = 0;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('regression: the browser’s own tries don’t slow the app’s reopening', () => {
  it('tries again 1 s after the silence check closes a stream the browser kept failing', () => {
    connect();
    outageUntilSilenceCheck();

    expect(waitForReopen()).toBe(LIVE_RETRY_MS);
  });

  it('backs off as before when the outage outlasts the next silence checks too', () => {
    connect();
    const waits = [0, 1, 2].map(() => {
      outageUntilSilenceCheck();
      return waitForReopen();
    });

    expect(waits).toEqual([retryDelay(0), retryDelay(1), retryDelay(2)]);
  });

  it('reopens 1 s after a drop whose first try the browser gets a 502 for', () => {
    connect();
    const source = MockEventSource.latest();
    source.fail(false);
    vi.advanceTimersByTime(BROWSER_RETRY_MS);
    source.fail(true);

    expect(waitForReopen()).toBe(LIVE_RETRY_MS);
  });

  it('still counts the browser’s tries toward reading on focus again', () => {
    const { onRefreshPending } = connect();
    const source = MockEventSource.latest();
    for (let attempt = 1; attempt < LIVE_WAIT_ATTEMPTS; attempt += 1) source.fail(false);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);

    source.fail(false);

    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
  });
});
