import { TrackerClient } from '@tracker/client';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjects } from '../../src/api';
import { apiWrapper, createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { noteAnswer } from '../../src/pwa/savedAnswers';
import { savedAnswerPlugin } from '../../src/pwa/savedAnswerPlugin';

// Behind a connection where reads take longer than the service worker's 3 s while /api/health,
// which the worker leaves to the network, answers at once: each recheck's answer took the banner
// down and read the project list again, and that read's saved answer put the banner back. It went
// up and down every 4 s, and the list was read 6 times in 30 s (PT-113 review).

const ORIGIN = 'http://localhost:5173';
// The service worker's networkTimeoutSeconds, after which it answers from its saved copy.
const WORKER_WAIT_MS = 3_000;
const A_WHILE_MS = 30_000;
const PROJECTS = [projectSummary()];

type Tracker = 'slow' | 'down' | 'up';

const bare502 = () => new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function network() {
  let tracker: Tracker = 'slow';
  const listReads: number[] = [];
  const read = async (request: Request): Promise<Response> => {
    if (tracker === 'up') return Response.json(PROJECTS);
    if (tracker === 'slow') await pause(WORKER_WAIT_MS);
    const saved = await savedAnswerPlugin.cachedResponseWillBeUsed({
      request,
      cachedResponse: Response.json(PROJECTS),
    });
    return saved ?? bare502();
  };
  // The client always asks with a path.
  const fetch = (path: string, init?: RequestInit): Promise<Response> => {
    const request = new Request(`${ORIGIN}${path}`, init);
    const url = new URL(request.url);
    if (url.pathname === '/api/projects') listReads.push(Date.now());
    if (isSavedApiRead({ url, request, sameOrigin: true })) return read(request);
    return Promise.resolve(tracker === 'down' ? bare502() : Response.json({ ok: true }));
  };
  return { fetch, listReads, set: (next: Tracker) => void (tracker = next) };
}

type Network = ReturnType<typeof network>;

function renderShell(net: Network) {
  vi.stubGlobal('fetch', net.fetch);
  const shown: boolean[] = [];
  const wrapper = apiWrapper(new TrackerClient({ baseUrl: '' }), createTestQueryClient());
  const view = renderHook(
    () => {
      useProjects();
      const unreachable = useApiUnreachable(useReachability());
      if (shown.at(-1) !== unreachable) shown.push(unreachable);
      return unreachable;
    },
    { wrapper },
  );
  return { ...view, shown };
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Unmount first: the app puts back the fetch it found, which is the fake one.
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  noteAnswer(new Response('[]'));
});

it('stays up while reads are slow and the tracker answers its checks, reading the list once more', async () => {
  const net = network();
  const started = Date.now();
  const { shown } = renderShell(net);

  await wait(A_WHILE_MS);

  expect(shown).toEqual([false, true]);
  // The first read, and one when a check first finds the tracker answering.
  expect(net.listReads.map((at) => at - started)).toEqual([0, WORKER_WAIT_MS + 1_000]);
});

it('still goes within 3 s of the tracker answering again after it was down', async () => {
  const net = network();
  net.set('down');
  const { result } = renderShell(net);
  await wait(A_WHILE_MS);
  expect(result.current).toBe(true);

  net.set('up');
  await wait(3_000);

  expect(result.current).toBe(false);
});
