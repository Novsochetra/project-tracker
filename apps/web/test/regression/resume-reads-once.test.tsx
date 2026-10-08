import type { SessionState } from '@tracker/shared';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_GRACE_MS } from '../../src/api/live/pauseWhileHidden';
import { fakeClient } from '../../src/api/test/fakeClient';
import {
  defaultTickets,
  listItem,
  makeBoard,
  makeTicketDetail,
  project,
  STATUS,
  statuses,
} from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// After the page was hidden for more than 30 s, TanStack Query's focus refetch read every open
// query, and the refresh when the reopened live stream opened read them all again. A phone that
// suspends a hidden page runs no timers, so there the stream was kept: the focus refetch read
// everything before the stream had caught up, and the overdue silence timer reopened it and read
// everything again.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const HIDDEN_MS = HIDDEN_GRACE_MS + 10_000;
const RENAMED = 'Crash on launch';

function fakeServer() {
  let first = listItem(1, STATUS.todo, 0);
  const routes = {
    getSession: vi.fn(() => Promise.resolve(OPEN_SESSION)),
    listProjects: vi.fn(() => Promise.resolve([projectSummary()])),
    listAllTickets: vi.fn(() => Promise.resolve({ tickets: [], statuses: [] })),
    getProject: vi.fn(() => Promise.resolve({ project, statuses })),
    getBoard: vi.fn(() => Promise.resolve(makeBoard([first, ...defaultTickets().slice(1)]))),
    getTicket: vi.fn(() => Promise.resolve(makeTicketDetail(first))),
    listPeople: vi.fn(() => Promise.resolve([])),
  };
  const calls: string[] = [];
  const counted = (name: string, route: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => {
      calls.push(name);
      return route(...args);
    };
  };
  const client = fakeClient(
    Object.fromEntries(Object.entries(routes).map(([name, route]) => [name, counted(name, route)])),
  );
  return {
    routes,
    client,
    readsSince: (mark: number) => countsOf(calls.slice(mark)),
    mark: () => calls.length,
    renameFirstTicket: () => void (first = { ...first, title: RENAMED }),
  };
}

function countsOf(names: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of names) counts[name] = (counts[name] ?? 0) + 1;
  return counts;
}

function renderApp(path: string, server = fakeServer()) {
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={createTestQueryClient()} />);
  return server;
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Browsers fire it at the document and it bubbles to window, where TanStack Query listens for focus.
function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => void document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
}

const ONE_EACH = { listProjects: 1, listAllTickets: 1, getBoard: 1 };

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

describe('regression: a resume reads each open query once', () => {
  it('reads after the reopened stream opens and shows what changed while hidden', async () => {
    const server = renderApp('/p/MOB/1');
    expect(await screen.findByDisplayValue('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    setVisibility('hidden');
    await advance(HIDDEN_MS);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
    server.renameFirstTicket();
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);
    const beforeOpen = server.readsSince(resumed);
    act(() => MockEventSource.latest().open());
    expect(await screen.findByDisplayValue(RENAMED)).toBeInTheDocument();
    await advance(50);

    expect(server.readsSince(resumed)).toEqual({ ...ONE_EACH, getTicket: 1, listPeople: 1 });
    expect(beforeOpen).toEqual({});
    expect(server.routes.getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });
  });

  it('reopens the stream of a phone that ran no timers while the page was hidden', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + HIDDEN_MS);
    server.renameFirstTicket();
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);
    const beforeOpen = server.readsSince(resumed);
    const second = MockEventSource.latest();
    act(() => second.open());
    expect(await screen.findByText(RENAMED)).toBeInTheDocument();
    await advance(50);

    expect(server.readsSince(resumed)).toEqual(ONE_EACH);
    expect(beforeOpen).toEqual({});
    expect(second).not.toBe(first);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
  });

  it('still reads on focus after a quick switch, while the stream stays open', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const source = MockEventSource.latest();
    act(() => source.open());
    await advance(HIDDEN_GRACE_MS);
    act(() => source.emit('', 'ping'));

    setVisibility('hidden');
    await advance(HIDDEN_GRACE_MS - 1_000);
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);

    expect(server.readsSince(resumed)).toEqual(ONE_EACH);
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
