import { TrackerClient } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE, queryKeys } from '../../src/api';
import { makeBoard, otherProject } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { announce } from '../../src/app/announce';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { QUEUE_STORAGE_KEY } from '../../src/features/capture/queueStore';
import { skipAnimations } from '../../src/overlays/testing';

// In production the service worker answers reads from its cache when the network fails. Those
// answers counted as the tracker answering: the offline banner went away, or never showed after
// a reload, while the server was down, and quick capture started syncing again.

const SAVED_DATA_MESSAGE = 'Offline — showing saved data';
// What the service worker adds to an answer it took from its cache.
const SAVED_ANSWER_HEADER = 'x-tracker-saved';
const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const ANSWERS: Record<string, unknown> = {
  '/api/session': OPEN_SESSION,
  '/api/projects': [
    projectSummary({ openCount: 3 }),
    projectSummary({ ...otherProject, openCount: 0 }),
  ],
  '/api/projects/MOB/board': makeBoard(),
};
const CAPTURE = {
  id: 'c-1',
  projectKey: 'MOB',
  title: 'Idea from the train',
  description: '',
  priority: 'medium',
  capturedAt: 1,
  attempted: false,
};

const json = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'application/json', ...headers } });

const NOT_FOUND = '{"error":{"code":"not_found","message":"Not found"}}';

// Network first, like the service worker: reads it got answers to are kept, and while the
// network is down they come from there, marked.
function fakeNetwork() {
  let up = true;
  const kept = new Map<string, string>();
  const requests: string[] = [];
  const whileDown = (method: string, url: string) => {
    const body = method === 'GET' ? kept.get(url) : undefined;
    if (body === undefined) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(json(body, 200, { [SAVED_ANSWER_HEADER]: '1' }));
  };
  // The client always asks with a URL string.
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${url}`);
    // A failed send takes a moment, like a real one, so the first sync is over before the reads below.
    if (!up && method !== 'GET') {
      return new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new TypeError('Failed to fetch')), 30),
      );
    }
    if (!up) return whileDown(method, url);
    if (method !== 'GET' || !(url in ANSWERS)) return Promise.resolve(json(NOT_FOUND, 404));
    const body = JSON.stringify(ANSWERS[url]);
    kept.set(url, body);
    return Promise.resolve(json(body));
  });
  return {
    fetch,
    requests,
    keepEverything: () =>
      Object.keys(ANSWERS).forEach((url) => kept.set(url, JSON.stringify(ANSWERS[url]))),
    stop: () => void (up = false),
    start: () => void (up = true),
  };
}

type FakeNetwork = ReturnType<typeof fakeNetwork>;

// The app's own client, so every request goes through the page's fetch as in production.
function renderApp(path: string, network: FakeNetwork) {
  vi.stubGlobal('fetch', network.fetch);
  window.history.replaceState(null, '', path);
  const queryClient = createTestQueryClient();
  render(<TrackerApp client={new TrackerClient({ baseUrl: '' })} queryClient={queryClient} />);
  return queryClient;
}

const banner = () => document.querySelector('.banner');
const liveRegion = () => document.querySelector('[aria-live="polite"]');
const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });
const MOVE_MOB_1 = 'Move MOB-1. Drag, or use the arrow keys.';
const captureRequests = (network: FakeNetwork) =>
  network.requests.filter((request) => request.includes('/api/projects/MOB/tickets'));

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  // Unmount first: the app puts back the fetch it found, which is the fake one.
  cleanup();
  vi.unstubAllGlobals();
  restore.forEach((undo) => undo());
  announce('');
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('regression: answers from the service worker cache keep the offline banner', () => {
  it('stays up when the project list is read again from the cache', async () => {
    const user = userEvent.setup();
    const network = fakeNetwork();
    const queryClient = renderApp('/p/MOB', network);
    await screen.findByRole('button', { name: MOVE_MOB_1 });
    const website = await within(sidebar()).findByRole('button', { name: 'Website 0 open' });
    expect(banner()).toBeNull();

    network.stop();
    await user.click(website);
    expect(await screen.findByText("Couldn't load this project")).toBeInTheDocument();
    await waitFor(() => expect(banner()).toHaveTextContent(NETWORK_ERROR_MESSAGE));

    // Focus or a live update reads the list again; the service worker answers from its cache.
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.projects() }));

    expect(banner()).toHaveTextContent(SAVED_DATA_MESSAGE);
    expect(liveRegion()).toHaveTextContent(SAVED_DATA_MESSAGE);
    expect(within(sidebar()).getByRole('button', { name: 'Mobile app 3 open' })).toBeVisible();
  });

  it('shows over the saved data after a reload while the server is down, until it answers', async () => {
    const network = fakeNetwork();
    network.keepEverything();
    network.stop();
    const queryClient = renderApp('/p/MOB', network);

    expect(await screen.findByRole('button', { name: MOVE_MOB_1 })).toBeInTheDocument();
    await waitFor(() => expect(banner()).toHaveTextContent(SAVED_DATA_MESSAGE));

    network.start();
    // The live stream reopens and everything is read again.
    await act(() => queryClient.refetchQueries());

    await waitFor(() => expect(banner()).toBeNull());
  });

  it('does not start quick capture sync again because of a cached answer', async () => {
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify({ items: [CAPTURE], created: [] }),
    );
    const network = fakeNetwork();
    network.keepEverything();
    network.stop();
    const queryClient = renderApp('/p/MOB', network);
    await screen.findByRole('button', { name: MOVE_MOB_1 });
    await waitFor(() => expect(captureRequests(network)).toHaveLength(1));
    // The failed send marked the tracker unreachable; let the sync that sent it finish.
    await waitFor(() => expect(banner()).not.toBeNull());
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.projects() });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(captureRequests(network)).toEqual(['POST /api/projects/MOB/tickets']);
  });
});
