import type { SessionState } from '@tracker/shared';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { defaultTickets, listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { ProjectScreen } from '../../src/app/lazyParts';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// Live updates only noticed a dead stream when the browser reported an error. The dev proxy keeps
// the browser's stream open after the API server crashes, and the server's heartbeat was a comment
// the browser never shows, so after a restart nothing refreshed until the user did something. And
// when the app started with the server down, the first stream that opened refreshed nothing.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const A_MINUTE = 60_000;

function fakeServer() {
  let up = true;
  let board = makeBoard();
  const route = (answer: () => unknown) =>
    vi.fn(() =>
      up ? Promise.resolve(answer()) : Promise.reject(new TypeError('Failed to fetch')),
    );
  const routes = {
    getSession: route(() => OPEN_SESSION),
    listProjects: route(() => [projectSummary()]),
    getBoard: route(() => board),
  };
  return {
    routes,
    client: fakeClient(routes),
    stop: () => void (up = false),
    start: () => void (up = true),
    renameFirstTicket: (title: string) => {
      board = makeBoard([listItem(1, STATUS.todo, 0, { title }), ...defaultTickets().slice(1)]);
    },
  };
}

function renderApp(path: string, server = fakeServer()) {
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={createTestQueryClient()} />);
  return server;
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const banner = () => document.querySelector('.banner');

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

describe('regression: live updates recover after the server restarts', () => {
  it('reopens a stream that went quiet and shows what changed meanwhile', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    // The server crashes and comes back with a change; the proxy keeps the old stream open and silent.
    server.renameFirstTicket('Crash on launch');
    await advance(A_MINUTE);

    expect(first.readyState).toBe(MockEventSource.CLOSED);
    const second = MockEventSource.latest();
    expect(second).not.toBe(first);
    act(() => second.open());

    expect(await screen.findByText('Crash on launch')).toBeInTheDocument();
  });

  it('loads the screen by itself once a server that was down at start comes up', async () => {
    const server = fakeServer();
    server.stop();
    renderApp('/p/MOB', server);
    expect(await screen.findByText("Couldn't load this project")).toBeInTheDocument();
    act(() => MockEventSource.latest().fail(true));

    server.start();
    await advance(5_000);
    act(() => MockEventSource.latest().open());

    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this project")).toBeNull();
    expect(banner()).toBeNull();
    expect(server.routes.getBoard).toHaveBeenCalledTimes(2);
  });
});
