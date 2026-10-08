import { act, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STALE_TIME_MS } from '../../src/api/queryClient';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, loadScreens, ONE_EACH, renderApp, setVisibility } from './countedReads';

// PT-82: only streams the browser gave up on counted toward the three failed tries after which
// focus reads stop waiting for the stream. A stream that dropped while the network or a proxy kept
// failing it is retried by the browser itself, so the count stayed at zero and coming back to the
// page read nothing until the 35 s silence check replaced the stream, three times over.

const STALE_MS = STALE_TIME_MS + 1_000;

// About a browser's own wait between tries of a dropped EventSource.
const BROWSER_RETRY_MS = 3_000;

let restore: Array<() => void> = [];

beforeAll(loadScreens);

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

async function openStaleStream() {
  const server = renderApp('/p/MOB');
  expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
  act(() => MockEventSource.latest().open());
  // Short of the 35 s silence check, so only the browser's own tries happen.
  await advance(STALE_MS - 3 * BROWSER_RETRY_MS);
  return server;
}

async function browserRetriesFail(times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    act(() => MockEventSource.latest().fail(false));
    await advance(BROWSER_RETRY_MS);
  }
}

async function comeBack() {
  setVisibility('hidden');
  setVisibility('visible');
  await advance(50);
}

describe('regression: tries the browser makes itself count toward focus reads coming back', () => {
  it('reads on focus once a dropped stream failed the browser’s tries a few times', async () => {
    const server = await openStaleStream();
    await browserRetriesFail(3);

    const back = server.mark();
    await comeBack();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });

  it('still waits for a stream the browser has tried again only once', async () => {
    const server = await openStaleStream();
    await browserRetriesFail(1);

    const back = server.mark();
    await comeBack();
    expect(server.readsSince(back)).toEqual({});
    act(() => MockEventSource.latest().open());
    await advance(50);

    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });
});
