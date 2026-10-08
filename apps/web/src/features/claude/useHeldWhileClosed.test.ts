import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHeldWhileClosed } from './useHeldWhileClosed';

function renderHeld<T>(value: T) {
  return renderHook(({ open, current }) => useHeldWhileClosed(open, current), {
    initialProps: { open: true, current: value },
  });
}

describe('useHeldWhileClosed', () => {
  it('follows the value while open and holds the last one once closed', () => {
    const { result, rerender } = renderHeld('typed');
    rerender({ open: true, current: 'previewed' });
    expect(result.current).toBe('previewed');
    rerender({ open: false, current: 'refetched' });
    expect(result.current).toBe('previewed');
    rerender({ open: false, current: 'refetched again' });
    expect(result.current).toBe('previewed');
    rerender({ open: true, current: 'reopened' });
    expect(result.current).toBe('reopened');
  });

  it('holds a function as a value instead of calling it', () => {
    const first = () => 'first';
    const { result, rerender } = renderHeld(first);
    rerender({ open: false, current: () => 'second' });
    expect(result.current).toBe(first);
  });
});
