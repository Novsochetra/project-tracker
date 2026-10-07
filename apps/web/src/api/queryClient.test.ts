import { ApiError } from '@tracker/client';
import { describe, expect, it } from 'vitest';
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
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    });
    expect(mutations).toMatchObject({ retry: 0, networkMode: 'always' });
  });
});
