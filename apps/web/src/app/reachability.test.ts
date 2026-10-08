import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api';
import { makeBoard } from '../api/test/fixtures';
import { createTestQueryClient, isInvalidated } from '../api/test/render';
import { noteAnswer, SAVED_ANSWER_HEADER } from '../pwa/savedAnswers';
import { signalOf } from './offline';
import { createReachability, watchApiTraffic, type Reachability } from './reachability';

const NETWORK_DOWN = new TypeError('Failed to fetch');
const fromNetwork = () => new Response('[]');
// What the service worker sends when it answers a read from its cache.
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
    expect(signalOf({ type: 'error', error: new ApiError(502, 'http_error', 'Bad Gateway') })).toBe(
      'unreachable',
    );
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
  let stop: () => void;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    reachability = createReachability();
    stop = watchApiTraffic(queryClient, reachability);
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
