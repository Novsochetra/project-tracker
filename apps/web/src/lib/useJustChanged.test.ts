import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJustChanged } from './useJustChanged';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const render = (value: string) =>
  renderHook(({ current }) => useJustChanged(current, 500), { initialProps: { current: value } });

describe('useJustChanged', () => {
  it('is false on the first render', () => {
    expect(render('send').result.current).toBe(false);
  });

  it('is true from the render with the new value until the time is up', () => {
    const { result, rerender } = render('done');
    rerender({ current: 'send' });
    expect(result.current).toBe(true);
    advance(499);
    expect(result.current).toBe(true);
    advance(1);
    expect(result.current).toBe(false);
  });

  it('starts over when the value changes again', () => {
    const { result, rerender } = render('done');
    rerender({ current: 'send' });
    advance(400);
    rerender({ current: 'done' });
    advance(400);
    expect(result.current).toBe(true);
    advance(100);
    expect(result.current).toBe(false);
  });

  it('stays false while the value stays the same', () => {
    const { result, rerender } = render('send');
    rerender({ current: 'send' });
    expect(result.current).toBe(false);
  });
});
