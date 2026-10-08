import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRetryWhenOnline } from './useRetryWhenOnline';

const goOnline = () => window.dispatchEvent(new Event('online'));

describe('useRetryWhenOnline', () => {
  it('retries on reconnect only while active, with the newest retry', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ active, retry }) => useRetryWhenOnline(active, retry),
      { initialProps: { active: false, retry: first } },
    );
    goOnline();
    expect(first).not.toHaveBeenCalled();
    rerender({ active: true, retry: second });
    goOnline();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    goOnline();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
