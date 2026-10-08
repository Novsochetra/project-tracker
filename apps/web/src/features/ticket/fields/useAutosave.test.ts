import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, useAutosave } from './useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('saves the latest value once typing pauses', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave(save));
    act(() => {
      result.current.schedule('F');
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
      result.current.schedule('Fix');
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledExactlyOnceWith('Fix');
  });

  it('saves right away on flush, and only once', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave(save));
    act(() => {
      result.current.schedule('Fix');
      result.current.flush();
      result.current.flush();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('Fix');
  });

  it('commits a given value right away in place of a pending one', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave(save));
    act(() => {
      result.current.schedule('Fi');
      result.current.commit('Fix');
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('Fix');
  });

  it('saves a pending value when the screen goes away', () => {
    const save = vi.fn();
    const { result, unmount } = renderHook(() => useAutosave(save));
    act(() => result.current.schedule('Fix'));
    unmount();
    expect(save).toHaveBeenCalledExactlyOnceWith('Fix');
  });

  it('uses the newest save function', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ save }) => useAutosave(save), {
      initialProps: { save: first },
    });
    act(() => result.current.schedule('Fix'));
    rerender({ save: second });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Fix');
  });
});
