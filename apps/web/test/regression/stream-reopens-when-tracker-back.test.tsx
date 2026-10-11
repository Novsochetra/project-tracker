import type { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { defaultTickets, listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { ProjectScreen } from '../../src/app/lazyParts';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// PT-118: since PT-113 the banner went within 3 s of the API answering again, but the screens'
// other data waited for the live stream's next try, up to 15 s later: its open is what refreshes
// them, and its backoff had grown through the outage.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
// The stream's tries after a drop: the browser's own at 3 s, then the app's 1, 2, 4 and 8 s later.
// Back at 20 s, its next try is 15 s after the one at 18 s.
const OUTAGE_MS = 20_000;
const BROWSER_RETRY_MS = 3_000;
const STEP_MS = 100;

function fakeServer() {
  let up = true;
  let board = makeBoard();
  const route = (answer: () => unknown) =>
    vi.fn(() =>
      up
        ? Promise.resolve(answer())
        : Promise.reject(new ApiError(502, 'http_error', 'Bad Gateway')),
    );
  const routes = {
    getSession: route(() => OPEN_SESSION),
    listProjects: route(() => [projectSummary()]),
    getBoard: route(() => board),
    checkHealth: route(() => ({ ok: true })),
  };
  return {
    client: fakeClient(routes),
    stop: () => void (up = false),
    start: () => void (up = true),
    renameFirstTicket: (title: string) => {
      board = makeBoard([listItem(1, STATUS.todo, 0, { title }), ...defaultTickets().slice(1)]);
    },
  };
}

function renderApp(path: string) {
  const server = fakeServer();
  const queryClient: QueryClient = createTestQueryClient();
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={queryClient} />);
  return { server, queryClient };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const banner = () => document.querySelector('.banner');

// Every stream the app opens meanwhile gets the proxy's bare 502, which the browser gives up on.
async function streamRefusedFor(ms: number) {
  const refused = new Set<MockEventSource>();
  for (let waited = 0; waited < ms; waited += STEP_MS) {
    const source = MockEventSource.latest();
    if (!refused.has(source) && source.readyState === MockEventSource.CONNECTING) {
      refused.add(source);
      act(() => source.fail(true));
    }
    await advance(STEP_MS);
  }
}

let restore: Array<() => void> = [];

// Not what they test: under load the screen's code came after a find gave up (PT-176).
beforeAll(() => ProjectScreen.preload());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('regression: the live stream reopens when the tracker answers again', () => {
  it('refreshes the screen with the banner going, not at the stream’s next try', async () => {
    const { server, queryClient } = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    // The API stops behind a proxy that answers a bare 502, and comes back with a change.
    server.stop();
    server.renameFirstTicket('Crash on launch');
    act(() => first.fail(false));
    await advance(BROWSER_RETRY_MS);
    act(() => first.fail(true));
    await act(() => queryClient.refetchQueries({ type: 'active' }));
    await streamRefusedFor(OUTAGE_MS - BROWSER_RETRY_MS);
    expect(banner()).not.toBeNull();
    const triedDuringOutage = MockEventSource.instances.length;

    server.start();
    await advance(3_000);

    expect(banner()).toBeNull();
    expect(MockEventSource.instances).toHaveLength(triedDuringOutage + 1);
    act(() => MockEventSource.latest().open());
    expect(await screen.findByText('Crash on launch')).toBeInTheDocument();
  });

  it('opens one stream, and the try it was waiting for doesn’t open another', async () => {
    const { server, queryClient } = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    act(() => MockEventSource.latest().open());
    server.stop();
    act(() => MockEventSource.latest().fail(true));
    await act(() => queryClient.refetchQueries({ type: 'active' }));
    await streamRefusedFor(OUTAGE_MS);
    const triedDuringOutage = MockEventSource.instances.length;

    server.start();
    await advance(3_000);
    act(() => MockEventSource.latest().open());
    await advance(15_000);

    expect(MockEventSource.instances).toHaveLength(triedDuringOutage + 1);
    expect(MockEventSource.latest().readyState).toBe(MockEventSource.OPEN);
  });
});
