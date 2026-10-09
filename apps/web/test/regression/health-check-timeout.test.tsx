import { MutationObserver } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';

// The check of a bare 5xx had no time limit. One left waiting, as on a proxy that holds the
// connection to a stuck API, kept the tracker reachable and left every later bare 5xx unchecked
// (PT-101 review).

const bare500 = () => new ApiError(500, 'http_error', 'Internal Server Error');
// Longer than the tracker takes to answer, even on a slow phone connection.
const A_LONG_WAIT_MS = 30_000;

function renderShell(checkHealth: (options?: { signal?: AbortSignal }) => Promise<unknown>) {
  const api = setupApi({ checkHealth });
  const view = renderHook(() => useApiUnreachable(useReachability()), { wrapper: api.wrapper });
  const settle = (answer: () => Promise<unknown>) =>
    act(() =>
      new MutationObserver(api.queryClient, { mutationFn: answer }).mutate().catch(() => undefined),
    );
  return { ...view, settle };
}

const signalsOf = (checkHealth: ReturnType<typeof vi.fn>) =>
  checkHealth.mock.calls.map(([options]) => (options as { signal?: AbortSignal }).signal);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('counts a check left without an answer as unreachable, and stops its request', async () => {
  const checkHealth = vi.fn(() => new Promise<never>(() => undefined));
  const { result, settle } = renderShell(checkHealth);

  await settle(() => Promise.reject(bare500()));
  expect(checkHealth).toHaveBeenCalledTimes(1);
  expect(result.current).toBe(false);

  await act(() => vi.advanceTimersByTimeAsync(A_LONG_WAIT_MS));

  expect(result.current).toBe(true);
  expect(signalsOf(checkHealth)[0]?.aborted).toBe(true);
});

it('checks a later bare 5xx once the tracker answers again', async () => {
  const checkHealth = vi.fn(() => new Promise<never>(() => undefined));
  const { result, settle } = renderShell(checkHealth);
  await settle(() => Promise.reject(bare500()));
  await act(() => vi.advanceTimersByTimeAsync(A_LONG_WAIT_MS));

  await settle(() => Promise.resolve('saved'));
  expect(result.current).toBe(false);
  await settle(() => Promise.reject(bare500()));

  expect(checkHealth).toHaveBeenCalledTimes(2);
});
