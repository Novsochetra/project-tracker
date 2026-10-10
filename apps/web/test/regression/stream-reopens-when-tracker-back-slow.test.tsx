import type { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';
import { noteAnswer, SAVED_ANSWER_HEADER } from '../../src/pwa/savedAnswers';

// Reviewer 125 (PT-126): after an outage, while reads stayed slower than the service worker's 3 s,
// the tracker answered its checks at once, but the live stream waited for its own next try, up to
// 15 s later, as it followed the banner, which saved reads kept up.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const WORKER_WAIT_MS = 3_000;
// The app's tries after the drop: 1, 2, 4 and 8 s apart. Slow from 20 s, its next try is at 30 s.
const OUTAGE_MS = 20_000;
const STEP_MS = 100;

type Tracker = 'up' | 'down' | 'slow';

const BARE_502 = new ApiError(502, 'http_error', 'Bad Gateway');
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const savedAnswer = () => new Response('[]', { headers: { [SAVED_ANSWER_HEADER]: '1' } });

function fakeServer() {
  let tracker: Tracker = 'up';
  const read = (answer: () => unknown) =>
    vi.fn(async () => {
      if (tracker === 'slow') await pause(WORKER_WAIT_MS);
      noteAnswer(tracker === 'up' ? new Response('[]') : savedAnswer());
      return answer();
    });
  const routes = {
    getSession: read(() => OPEN_SESSION),
    listProjects: read(() => [projectSummary()]),
    getBoard: read(() => makeBoard()),
    checkHealth: vi.fn(() =>
      tracker === 'down' ? Promise.reject(BARE_502) : Promise.resolve({ ok: true }),
    ),
  };
  return { client: fakeClient(routes), set: (next: Tracker) => void (tracker = next) };
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
  noteAnswer(new Response('[]'));
});

it('reopens the live stream once the tracker answers again, though reads are slow', async () => {
  const { server, queryClient } = renderApp('/p/MOB');
  expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
  act(() => MockEventSource.latest().open());

  server.set('down');
  act(() => MockEventSource.latest().fail(true));
  await act(() => queryClient.refetchQueries({ type: 'active' }));
  await streamRefusedFor(OUTAGE_MS);
  expect(banner()).not.toBeNull();
  const triedDuringOutage = MockEventSource.instances.length;

  server.set('slow');
  await advance(3_000);

  expect(MockEventSource.instances).toHaveLength(triedDuringOutage + 1);
  expect(banner()).not.toBeNull();
});
