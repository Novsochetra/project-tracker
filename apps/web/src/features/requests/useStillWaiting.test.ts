import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStillWaiting } from './useStillWaiting';

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('useStillWaiting', () => {
  it('waits until the deadline, and no longer', () => {
    const until = Date.now() + 5_000;
    const { result } = renderHook(() => useStillWaiting(until));
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('does not wait without a deadline or past it', () => {
    expect(renderHook(() => useStillWaiting(null)).result.current).toBe(false);
    const now = Date.now();
    expect(renderHook(() => useStillWaiting(now)).result.current).toBe(false);
  });

  it('waits again for a later request', () => {
    const { result, rerender } = renderHook(({ until }) => useStillWaiting(until), {
      initialProps: { until: Date.now() + 1_000 },
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(false);
    rerender({ until: Date.now() + 1_000 });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(false);
  });

  it('stops waiting when its timer fires, even on a clock set back meanwhile', () => {
    const until = Date.now() + 5_000;
    const { result } = renderHook(() => useStillWaiting(until));
    vi.setSystemTime(Date.now() - 60_000);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(false);
  });
});
