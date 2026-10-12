import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';

// In the iOS Simulator, WebKit kept navigator.onLine false for 20 minutes after the Mac's network
// came back, and the banner said "Offline — showing saved data" the whole time while the tracker
// answered every request (PT-179).

const NETWORK_DOWN = new TypeError('Failed to fetch');
const A_WHILE_MS = 30_000;

function renderShell(checkHealth: () => Promise<unknown>) {
  const api = setupApi({ checkHealth });
  return renderHook(() => useApiUnreachable(useReachability()), { wrapper: api.wrapper });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('goes once the tracker answers, though the browser still says it is offline', async () => {
  const checkHealth = vi.fn(() => Promise.resolve({ ok: true }));
  const { result } = renderShell(checkHealth);
  expect(result.current).toBe(true);

  await wait(3_000);

  expect(result.current).toBe(false);
  expect(checkHealth).toHaveBeenCalledTimes(1);
});

it('goes after an offline event once the tracker answers, and checks no more', async () => {
  const checkHealth = vi.fn(() => Promise.resolve({ ok: true }));
  const { result } = renderShell(checkHealth);
  await wait(3_000);

  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
  expect(result.current).toBe(true);
  await wait(A_WHILE_MS);

  expect(result.current).toBe(false);
  expect(checkHealth).toHaveBeenCalledTimes(2);
});

it('stays up while the tracker gives no answer', async () => {
  const checkHealth = vi.fn(() => Promise.reject(NETWORK_DOWN));
  const { result } = renderShell(checkHealth);

  await wait(A_WHILE_MS);

  expect(result.current).toBe(true);
  expect(checkHealth.mock.calls.length).toBeGreaterThan(5);
});
