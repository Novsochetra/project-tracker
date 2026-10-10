import { MutationObserver } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';

// With the API stopped behind a proxy that answers a bare 502, only the live stream asked whether
// the tracker was back, and it waits up to 15 s between tries: the banner went about 26 s after
// the API answered again (PT-113).

type HealthRead = (options?: { signal?: AbortSignal }) => Promise<unknown>;

const NETWORK_DOWN = new TypeError('Failed to fetch');
const bare502 = () => new ApiError(502, 'http_error', 'Bad Gateway');
const A_LONG_OUTAGE_MS = 60_000;

function renderShell(checkHealth: HealthRead) {
  const api = setupApi({ checkHealth });
  const view = renderHook(() => useApiUnreachable(useReachability()), { wrapper: api.wrapper });
  const loseTracker = () =>
    act(() =>
      new MutationObserver(api.queryClient, { mutationFn: () => Promise.reject(NETWORK_DOWN) })
        .mutate()
        .catch(() => undefined),
    );
  return { ...view, loseTracker };
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('goes within 3 s of the tracker answering again, with no other request', async () => {
  let up = false;
  const checkHealth = vi.fn(() => (up ? Promise.resolve({ ok: true }) : Promise.reject(bare502())));
  const { result, loseTracker } = renderShell(checkHealth);
  await loseTracker();
  await wait(A_LONG_OUTAGE_MS);
  expect(result.current).toBe(true);

  up = true;
  await wait(3_000);

  expect(result.current).toBe(false);
});

it('checks a few seconds apart while the tracker stays down', async () => {
  const checkHealth = vi.fn(() => Promise.reject(bare502()));
  const { result, loseTracker } = renderShell(checkHealth);
  await loseTracker();

  await wait(A_LONG_OUTAGE_MS);

  expect(result.current).toBe(true);
  expect(checkHealth.mock.calls.length).toBeGreaterThan(10);
  expect(checkHealth.mock.calls.length).toBeLessThanOrEqual(1 + A_LONG_OUTAGE_MS / 3_000);
});

it('lets each check left hanging end before the next one starts', async () => {
  const open = new Set<AbortSignal>();
  let mostOpen = 0;
  const checkHealth = vi.fn(
    ({ signal }: { signal?: AbortSignal } = {}) =>
      new Promise((_, reject) => {
        open.add(signal!);
        mostOpen = Math.max(mostOpen, open.size);
        signal!.addEventListener('abort', () => {
          open.delete(signal!);
          reject(new DOMException('', 'AbortError'));
        });
      }),
  );
  const { result, loseTracker } = renderShell(checkHealth);
  await loseTracker();

  await wait(A_LONG_OUTAGE_MS);

  expect(result.current).toBe(true);
  expect(checkHealth.mock.calls.length).toBeGreaterThan(5);
  expect(mostOpen).toBe(1);
});
