import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ticks on the interval', () => {
    const start = Date.now();
    const { result } = renderHook(() => useNow(60_000));
    expect(result.current).toBe(start);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(start + 60_000);
  });

  it('catches up when the page becomes visible again', () => {
    const { result } = renderHook(() => useNow());
    vi.setSystemTime(Date.now() + 5 * 60_000);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(Date.now());
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
