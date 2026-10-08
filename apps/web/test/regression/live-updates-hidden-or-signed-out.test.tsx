import { ApiError } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_GRACE_MS } from '../../src/api/live/pauseWhileHidden';
import { fakeClient } from '../../src/api/test/fakeClient';
import { defaultTickets, listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// The live-update stream stayed open while the page was hidden, so a phone in a pocket woke its
// radio for a ping every 15 s. And when the server came back needing a new token, the stream got a
// 401 on every retry while the page stayed stale; the token screen only showed once the user acted.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const SIGNED_OUT: SessionState = { authRequired: true, authenticated: false };
const TEN_MINUTES = 10 * 60_000;

function fakeServer() {
  let session = OPEN_SESSION;
  let board = makeBoard();
  const route = (answer: () => unknown) =>
    vi.fn(() =>
      session.authenticated
        ? Promise.resolve(answer())
        : Promise.reject(new ApiError(401, 'unauthorized', 'Enter the access token.')),
    );
  const routes = {
    getSession: vi.fn(() => Promise.resolve(session)),
    listProjects: route(() => [projectSummary()]),
    getBoard: route(() => board),
  };
  return {
    routes,
    client: fakeClient(routes),
    requireToken: () => void (session = SIGNED_OUT),
    renameFirstTicket: (title: string) => {
      board = makeBoard([listItem(1, STATUS.todo, 0, { title }), ...defaultTickets().slice(1)]);
    },
  };
}

function renderApp(path: string) {
  const server = fakeServer();
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={createTestQueryClient()} />);
  return server;
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Dispatched on the document only: TanStack Query's focus refetch listens on window, so the live
// stream is the only thing that reacts here.
function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

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

describe('regression: live updates pause while the page is hidden', () => {
  it('closes the stream while hidden and shows what changed once the page is visible', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    setVisibility('hidden');
    await advance(HIDDEN_GRACE_MS);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
    server.renameFirstTicket('Crash on launch');
    await advance(TEN_MINUTES);
    expect(MockEventSource.instances).toEqual([first]);
    expect(screen.getByText('Ticket 1')).toBeInTheDocument();

    setVisibility('visible');
    const second = MockEventSource.latest();
    expect(second).not.toBe(first);
    act(() => second.open());

    expect(await screen.findByText('Crash on launch')).toBeInTheDocument();
    expect(server.routes.getSession).toHaveBeenCalledTimes(1);
  });
});

describe('regression: live updates notice a lost session', () => {
  it('shows the token screen by itself when the server refuses the stream', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    // The server restarts with a new token: the browser's own retry of the stream gets a 401.
    server.requireToken();
    act(() => {
      first.fail(false);
      first.fail(true);
    });

    expect(
      await screen.findByRole('heading', { name: 'Enter your access token' }),
    ).toBeInTheDocument();
    const streams = MockEventSource.instances.length;
    await advance(TEN_MINUTES);
    expect(MockEventSource.instances).toHaveLength(streams);
    expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);
  });
});
