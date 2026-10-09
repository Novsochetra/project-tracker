import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { queryKeys } from '../api';
import { deferred } from '../api/test/deferred';
import { makeBoard } from '../api/test/fixtures';
import { createTestQueryClient, isInvalidated } from '../api/test/render';
import { noteAnswer, SAVED_ANSWER_HEADER } from '../pwa/savedAnswers';
import { signalOf } from './offline';
import { createReachability, watchApiTraffic, type Reachability } from './reachability';
import { RECHECK_MAX_MS, RECHECK_MS } from './recheck';
import { sharedCheck } from './trackerCheck';

const NETWORK_DOWN = new TypeError('Failed to fetch');
const BARE_500 = new ApiError(500, 'http_error', 'Internal Server Error');
const BARE_502 = new ApiError(502, 'http_error', 'Bad Gateway');
const settled = () => new Promise((resolve) => setTimeout(resolve));
const fromNetwork = () => new Response('[]');
const fromCache = () => new Response('[]', { headers: { [SAVED_ANSWER_HEADER]: '1' } });

describe('signalOf', () => {
  it('counts every answer from the server as reachable', () => {
    expect(signalOf({ type: 'success' })).toBe('reachable');
    expect(signalOf({ type: 'error', error: new ApiError(404, 'not_found', 'x') })).toBe(
      'reachable',
    );
    expect(signalOf({ type: 'error', error: new ApiError(500, 'internal', 'Locked') })).toBe(
      'reachable',
    );
  });

  it('counts requests that never reached the server as unreachable', () => {
    expect(signalOf({ type: 'error', error: NETWORK_DOWN })).toBe('unreachable');
  });

  it("is unsure of a bare 5xx, a proxy's for a stopped API or one request's own", () => {
    expect(signalOf({ type: 'error', error: BARE_502 })).toBe('unsure');
    expect(signalOf({ type: 'error', error: BARE_500 })).toBe('unsure');
  });

  it('ignores cache writes, progress and errors that say nothing about the server', () => {
    expect(signalOf({ type: 'success', manual: true })).toBeNull();
    expect(signalOf({ type: 'fetch' })).toBeNull();
    expect(signalOf({ type: 'failed', error: NETWORK_DOWN })).toBeNull();
    expect(signalOf({ type: 'error', error: new SyntaxError('Unexpected token') })).toBeNull();
  });

  it('counts a read the service worker answered from its cache as unreachable', () => {
    expect(signalOf({ type: 'success' }, true)).toBe('unreachable');
    expect(signalOf({ type: 'success', manual: true }, true)).toBeNull();
    expect(signalOf({ type: 'error', error: new ApiError(404, 'not_found', 'x') }, true)).toBe(
      'reachable',
    );
  });
});

describe('createReachability', () => {
  it('starts reachable and tells listeners only about changes', () => {
    const reachability = createReachability();
    const listener = vi.fn();
    reachability.subscribe(listener);
    expect(reachability.isUnreachable()).toBe(false);

    expect(reachability.setUnreachable(true)).toBe(true);
    expect(reachability.setUnreachable(true)).toBe(false);
    expect(reachability.isUnreachable()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(reachability.setUnreachable(false)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('watchApiTraffic', () => {
  let queryClient: QueryClient;
  let reachability: Reachability;
  // The health read the check sends.
  let check: Mock<() => Promise<unknown>>;
  let stop: () => void;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    reachability = createReachability();
    check = vi.fn(() => Promise.resolve({ ok: true }));
    stop = watchApiTraffic(queryClient, reachability, sharedCheck(check));
  });

  afterEach(() => {
    stop();
    noteAnswer(fromNetwork());
  });

  const load = (queryKey: readonly unknown[], answer: () => Promise<unknown>) =>
    queryClient.fetchQuery({ queryKey, queryFn: answer }).catch(() => undefined);

  const write = (answer: () => Promise<unknown>) =>
    new MutationObserver(queryClient, { mutationFn: answer }).mutate().catch(() => undefined);

  it('notices a query that cannot reach the server', async () => {
    await load(queryKeys.board('MOB'), () => Promise.reject(NETWORK_DOWN));
    expect(reachability.isUnreachable()).toBe(true);
  });

  it('notices a write that cannot reach the server', async () => {
    await write(() => Promise.reject(NETWORK_DOWN));
    expect(reachability.isUnreachable()).toBe(true);
  });

  it('recovers on a successful write', async () => {
    reachability.setUnreachable(true);
    await write(() => Promise.resolve('saved'));
    expect(reachability.isUnreachable()).toBe(false);
  });

  it('ignores data written straight into the cache', () => {
    reachability.setUnreachable(true);
    queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
    expect(reachability.isUnreachable()).toBe(true);
  });

  it('refreshes the project list when another answer comes back', async () => {
    queryClient.setQueryData(queryKeys.projects(), []);
    await load(queryKeys.board('MOB'), () => Promise.reject(NETWORK_DOWN));
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);

    await load(queryKeys.board('MOB'), () => Promise.resolve(makeBoard()));

    expect(reachability.isUnreachable()).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
  });

  it('does not refetch the project list when it is the answer that came back', async () => {
    reachability.setUnreachable(true);
    const listProjects = vi.fn(() => Promise.resolve([]));
    await load(queryKeys.projects(), listProjects);

    expect(reachability.isUnreachable()).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);
    expect(listProjects).toHaveBeenCalledTimes(1);
  });

  it('stops listening', async () => {
    stop();
    await load(queryKeys.board('MOB'), () => Promise.reject(NETWORK_DOWN));
    expect(reachability.isUnreachable()).toBe(false);
  });

  it('notices a request that never reached the server without a check', async () => {
    await write(() => Promise.reject(NETWORK_DOWN));
    expect(check).not.toHaveBeenCalled();
  });

  describe('with a bare 5xx', () => {
    it('checks the tracker, and stays reachable while it answers', async () => {
      await write(() => Promise.reject(BARE_500));
      await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(1));
      expect(reachability.isUnreachable()).toBe(false);
    });

    it.each([
      ['a bare 5xx: a proxy for a stopped API', BARE_502],
      ['no answer', NETWORK_DOWN],
    ])('counts as unreachable when the check gets %s too', async (_name, error) => {
      check.mockRejectedValue(error);
      await load(queryKeys.board('MOB'), () => Promise.reject(BARE_502));
      await vi.waitFor(() => expect(reachability.isUnreachable()).toBe(true));
    });

    it('counts any other answer to the check as reachable', async () => {
      check.mockRejectedValue(new ApiError(500, 'internal', 'Database is locked.'));
      await write(() => Promise.reject(BARE_500));
      await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(1));
      expect(reachability.isUnreachable()).toBe(false);
    });

    it('checks once at a time', async () => {
      const answer = deferred<unknown>();
      check.mockReturnValue(answer.promise);
      await write(() => Promise.reject(BARE_500));
      await write(() => Promise.reject(BARE_500));
      expect(check).toHaveBeenCalledTimes(1);

      answer.resolve({ ok: true });
      await settled();
      await write(() => Promise.reject(BARE_500));
      expect(check).toHaveBeenCalledTimes(2);
    });

    it('checks nothing while the tracker is already unreachable', async () => {
      reachability.setUnreachable(true);
      await write(() => Promise.reject(BARE_500));
      expect(check).not.toHaveBeenCalled();
      expect(reachability.isUnreachable()).toBe(true);
    });

    it('ignores a check that ends after it stopped listening', async () => {
      const answer = deferred<unknown>();
      check.mockReturnValue(answer.promise);
      await write(() => Promise.reject(BARE_500));
      stop();

      answer.reject(NETWORK_DOWN);
      await settled();

      expect(reachability.isUnreachable()).toBe(false);
    });
  });

  describe('rechecks while the tracker cannot be reached', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('asks again, and refreshes the project list once the tracker answers', async () => {
      stop();
      stop = watchApiTraffic(queryClient, reachability, sharedCheck(check), { recheck: true });
      queryClient.setQueryData(queryKeys.projects(), []);
      check.mockRejectedValue(NETWORK_DOWN);
      await write(() => Promise.reject(NETWORK_DOWN));
      await vi.advanceTimersByTimeAsync(RECHECK_MS);
      expect(check).toHaveBeenCalledTimes(1);
      expect(reachability.isUnreachable()).toBe(true);

      check.mockResolvedValue({ ok: true });
      await vi.advanceTimersByTimeAsync(RECHECK_MAX_MS);

      expect(reachability.isUnreachable()).toBe(false);
      expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
    });

    it('only when asked to: one schedule for the banner, not one per watcher', async () => {
      await write(() => Promise.reject(NETWORK_DOWN));
      await vi.advanceTimersByTimeAsync(30_000);
      expect(check).not.toHaveBeenCalled();
    });
  });

  describe('with reads answered from the service worker cache', () => {
    const loadBoard = (projectKey = 'MOB') =>
      load(queryKeys.board(projectKey), () => Promise.resolve(makeBoard()));

    it('notices the server is down even though every read succeeds', async () => {
      noteAnswer(fromCache());
      await loadBoard();
      expect(reachability.isUnreachable()).toBe(true);
    });

    it('never tells listeners, such as capture sync, that the server is back', async () => {
      reachability.setUnreachable(true);
      queryClient.setQueryData(queryKeys.projects(), []);
      const listener = vi.fn();
      reachability.subscribe(listener);

      noteAnswer(fromCache());
      await loadBoard();

      expect(reachability.isUnreachable()).toBe(true);
      expect(listener).not.toHaveBeenCalled();
      expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);
    });

    it('recovers once a read is answered by the network again', async () => {
      noteAnswer(fromCache());
      await loadBoard();

      noteAnswer(fromNetwork());
      await loadBoard('WEB');

      expect(reachability.isUnreachable()).toBe(false);
    });

    it('still counts a successful write, which never comes from the cache', async () => {
      reachability.setUnreachable(true);
      noteAnswer(fromCache());
      await write(() => Promise.resolve('saved'));
      expect(reachability.isUnreachable()).toBe(false);
    });
  });
});
