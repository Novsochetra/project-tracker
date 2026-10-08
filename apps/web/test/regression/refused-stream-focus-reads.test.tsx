import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryDelay } from '../../src/api/live/backoff';
import { STALE_TIME_MS } from '../../src/api/queryClient';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, ONE_EACH, renderApp, setVisibility } from './countedReads';

// Behind a proxy that refuses the live stream while the API answers, the stream never opened, so
// the refresh its opening brings never came, and focus reads waited for it for good: coming back
// to the page never read anything again.

const STALE_MS = STALE_TIME_MS + 1_000;

let restore: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

async function refuseStream(times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    act(() => MockEventSource.latest().fail(true));
    await advance(retryDelay(attempt));
  }
}

async function comeBack() {
  setVisibility('hidden');
  setVisibility('visible');
  await advance(50);
}

describe('regression: focus reads come back when the live stream keeps failing', () => {
  it('reads on focus once the stream has been refused a few times', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    await refuseStream(3);
    await advance(STALE_MS);

    const back = server.mark();
    await comeBack();

    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });

  it('still waits for a stream that failed once and is about to reopen', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    act(() => MockEventSource.latest().open());
    await advance(STALE_MS);
    act(() => MockEventSource.latest().fail(true));

    const back = server.mark();
    await comeBack();
    expect(server.readsSince(back)).toEqual({});
    await advance(retryDelay(0));
    act(() => MockEventSource.latest().open());
    await advance(50);

    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });
});
