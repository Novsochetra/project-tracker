import { MutationObserver, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { hasPendingWrites } from '../lib/pendingWrites';
import { setLiveRefreshPending } from './live/refreshPending';
import { createQueryClient, retryOnce, STALE_TIME_MS } from './queryClient';

describe('retryOnce', () => {
  it('retries network and server failures once', () => {
    expect(retryOnce(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(retryOnce(0, new ApiError(500, 'internal', 'x'))).toBe(true);
    expect(retryOnce(1, new TypeError('Failed to fetch'))).toBe(false);
  });

  it('never retries client errors', () => {
    expect(retryOnce(0, new ApiError(401, 'unauthorized', 'x'))).toBe(false);
    expect(retryOnce(0, new ApiError(404, 'not_found', 'x'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('sets the app defaults', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries).toMatchObject({
      staleTime: STALE_TIME_MS,
      retry: retryOnce,
      networkMode: 'offlineFirst',
    });
    expect(mutations).toMatchObject({ retry: 0, networkMode: 'always' });
  });
});

function watchStaleQuery(queryClient: QueryClient) {
  queryClient.setQueryData(['projects'], 'saved', { updatedAt: Date.now() - STALE_TIME_MS - 1 });
  const queryFn = vi.fn().mockResolvedValue('fresh');
  const observer = new QueryObserver(queryClient, {
    queryKey: ['projects'],
    queryFn,
    refetchOnMount: false,
  });
  const stop = observer.subscribe(() => undefined);
  return { queryFn, stop };
}

async function pageVisibleAgain() {
  window.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('refetch on focus', () => {
  it('reads stale queries when the page is visible again', async () => {
    const queryClient = createQueryClient();
    queryClient.mount();
    const { queryFn, stop } = watchStaleQuery(queryClient);

    await pageVisibleAgain();

    expect(queryFn).toHaveBeenCalledTimes(1);
    stop();
    queryClient.unmount();
  });

  it('leaves them to a live stream that refreshes everything once it opens', async () => {
    const queryClient = createQueryClient();
    queryClient.mount();
    const { queryFn, stop } = watchStaleQuery(queryClient);
    setLiveRefreshPending(queryClient, true);

    await pageVisibleAgain();

    expect(queryFn).not.toHaveBeenCalled();
    setLiveRefreshPending(queryClient, false);
    await pageVisibleAgain();
    expect(queryFn).toHaveBeenCalledTimes(1);
    stop();
    queryClient.unmount();
  });
});

// TanStack Query reads stale queries when the browser says it is online again after offline.
async function browserOnlineAgain() {
  window.dispatchEvent(new Event('offline'));
  window.dispatchEvent(new Event('online'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('refetch on reconnect', () => {
  it('reads stale queries when the browser is online again', async () => {
    const queryClient = createQueryClient();
    queryClient.mount();
    const { queryFn, stop } = watchStaleQuery(queryClient);

    await browserOnlineAgain();

    expect(queryFn).toHaveBeenCalledTimes(1);
    stop();
    queryClient.unmount();
  });

  it('leaves them to a live stream that refreshes everything once it opens', async () => {
    const queryClient = createQueryClient();
    queryClient.mount();
    const { queryFn, stop } = watchStaleQuery(queryClient);
    setLiveRefreshPending(queryClient, true);

    await browserOnlineAgain();

    expect(queryFn).not.toHaveBeenCalled();
    setLiveRefreshPending(queryClient, false);
    await browserOnlineAgain();
    expect(queryFn).toHaveBeenCalledTimes(1);
    stop();
    queryClient.unmount();
  });
});

function startWrite(queryClient = createQueryClient()) {
  let resolve: (value: string) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const response = new Promise<string>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  const observer = new MutationObserver(queryClient, { mutationFn: () => response });
  return { resolve, reject, write: observer.mutate() };
}

describe('pending writes', () => {
  it('reports a write in flight until it succeeds', async () => {
    const { resolve, write } = startWrite();
    expect(hasPendingWrites()).toBe(true);
    resolve('saved');
    await write;
    expect(hasPendingWrites()).toBe(false);
  });

  it('reports a write in flight until it fails', async () => {
    const { reject, write } = startWrite();
    expect(hasPendingWrites()).toBe(true);
    reject(new TypeError('Failed to fetch'));
    await expect(write).rejects.toThrow('Failed to fetch');
    expect(hasPendingWrites()).toBe(false);
  });

  it('keeps reporting while another write is still in flight', async () => {
    const queryClient = createQueryClient();
    const first = startWrite(queryClient);
    const second = startWrite(queryClient);
    first.resolve('saved');
    await first.write;
    expect(hasPendingWrites()).toBe(true);
    second.resolve('saved');
    await second.write;
    expect(hasPendingWrites()).toBe(false);
  });
});
