import type { SessionState } from '@tracker/shared';
import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
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
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';

// The whole app over a tracker that counts its reads, for checks that a page reads each open
// query once when it comes back (from hidden, offline or a broken live stream).

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

export const RENAMED = 'Crash on launch';

// What the project screen reads.
export const ONE_EACH = { listProjects: 1, listAllTickets: 1, getBoard: 1 };

function countsOf(names: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of names) counts[name] = (counts[name] ?? 0) + 1;
  return counts;
}

export function fakeServer() {
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

export function renderApp(path: string, server = fakeServer()) {
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={createTestQueryClient()} />);
  return server;
}

export const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Browsers fire it at the document and it bubbles to window, where TanStack Query listens for focus.
export function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => void document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
}

// TanStack Query listens on window for the browser's online and offline events.
export function setOnline(online: boolean) {
  act(() => void window.dispatchEvent(new Event(online ? 'online' : 'offline')));
}
