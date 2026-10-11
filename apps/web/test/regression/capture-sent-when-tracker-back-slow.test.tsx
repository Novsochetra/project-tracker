import { TrackerClient } from '@tracker/client';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjects } from '../../src/api';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { apiWrapper, createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';
import { ToastProvider } from '../../src/components';
import { addCapture } from '../../src/features/capture/captureQueue';
import { readQueue, updateQueue } from '../../src/features/capture/queueStore';
import { useCaptureSync } from '../../src/features/capture/useCaptureSync';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { noteAnswer } from '../../src/pwa/savedAnswers';
import { savedAnswerPlugin } from '../../src/pwa/savedAnswerPlugin';

// Reviewer 125 (PT-126): a capture saved on the phone during an outage waited after the tracker
// was back, while reads stayed slower than the service worker's 3 s; writes went at once.

const ORIGIN = 'http://localhost:5173';
const WORKER_WAIT_MS = 3_000;
const PROJECTS = [projectSummary()];

type Tracker = 'down' | 'slow';

const bare502 = () => new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function network() {
  let tracker: Tracker = 'down';
  const posts: string[] = [];
  const read = async (request: Request): Promise<Response> => {
    if (tracker === 'slow') await pause(WORKER_WAIT_MS);
    const saved = await savedAnswerPlugin.cachedResponseWillBeUsed({
      request,
      cachedResponse: Response.json(PROJECTS),
    });
    return saved ?? bare502();
  };
  const fetch = (path: string, init?: RequestInit): Promise<Response> => {
    const request = new Request(`${ORIGIN}${path}`, init);
    const url = new URL(request.url);
    const isRead = request.method === 'GET';
    if (isRead && isSavedApiRead({ url, request, sameOrigin: true })) return read(request);
    if (tracker === 'down') return Promise.resolve(bare502());
    if (!isRead) {
      posts.push(url.pathname);
      const { commentCount: _c, attachmentCount: _a, ...ticket } = listItem(7, STATUS.todo, 0);
      return Promise.resolve(Response.json(ticket, { status: 201 }));
    }
    return Promise.resolve(Response.json({ ok: true }));
  };
  return { fetch, posts, set: (next: Tracker) => void (tracker = next) };
}

function renderShell(net: ReturnType<typeof network>) {
  vi.stubGlobal('fetch', net.fetch);
  const api = apiWrapper(new TrackerClient({ baseUrl: '' }), createTestQueryClient());
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(api, null, createElement(ToastProvider, null, children));
  return renderHook(
    () => {
      useProjects();
      const reachability = useReachability();
      useCaptureSync(reachability);
      return useApiUnreachable(reachability);
    },
    { wrapper },
  );
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  noteAnswer(new Response('[]'));
  window.localStorage.clear();
});

it('sends a capture saved during an outage once the tracker answers again, though reads are slow', async () => {
  const net = network();
  const { result } = renderShell(net);
  await wait(10_000);
  expect(result.current).toBe(true);
  act(() => {
    updateQueue((queue) =>
      addCapture(queue, {
        id: 'queued-1',
        projectKey: 'MOB',
        title: 'Saved on the phone',
        description: '',
        priority: 'medium',
        capturedAt: Date.now(),
      }),
    );
  });

  net.set('slow');
  await wait(10_000);

  expect(net.posts).toEqual(['/api/projects/MOB/tickets']);
  expect(readQueue().items).toEqual([]);
});
