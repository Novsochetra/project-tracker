import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePainted } from './usePainted';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });

describe('usePainted', () => {
  it('is false until the frame after the first paint', () => {
    const { result } = renderHook(() => usePainted());
    expect(result.current).toBe(false);
    nextFrame();
    expect(result.current).toBe(false);
    nextFrame();
    expect(result.current).toBe(true);
  });

  it('asks for no more frames once unmounted', () => {
    const { unmount } = renderHook(() => usePainted());
    nextFrame();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
