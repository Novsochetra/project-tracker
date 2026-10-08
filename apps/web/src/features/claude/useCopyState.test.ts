import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIED_MS } from './sendPrompt';
import { useCopyState } from './useCopyState';

describe('useCopyState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Copied for 2s, restarting on every copy', () => {
    const { result } = renderHook(() => useCopyState());
    act(() => result.current[1]('copied'));
    act(() => void vi.advanceTimersByTime(COPIED_MS - 500));
    act(() => result.current[1]('copied'));
    act(() => void vi.advanceTimersByTime(COPIED_MS - 1));
    expect(result.current[0]).toBe('copied');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current[0]).toBeNull();
  });

  it('keeps a failure until the next attempt', () => {
    const { result } = renderHook(() => useCopyState());
    act(() => result.current[1]('failed'));
    act(() => void vi.advanceTimersByTime(COPIED_MS * 2));
    expect(result.current[0]).toBe('failed');
    act(() => result.current[1]('copied'));
    expect(result.current[0]).toBe('copied');
  });
});
