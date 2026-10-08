import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hasDrafts } from './drafts';
import { useDraftMark } from './useDraftMark';

describe('useDraftMark', () => {
  it('marks the draft only while it is active, and clears it on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ active }) => useDraftMark('comment:MOB-1', active),
      {
        initialProps: { active: false },
      },
    );
    expect(hasDrafts()).toBe(false);
    rerender({ active: true });
    expect(hasDrafts()).toBe(true);
    rerender({ active: false });
    expect(hasDrafts()).toBe(false);
    rerender({ active: true });
    unmount();
    expect(hasDrafts()).toBe(false);
  });

  it('keeps the draft while another component with the same id still marks it', () => {
    const first = renderHook(() => useDraftMark('comment:MOB-1', true));
    const second = renderHook(() => useDraftMark('comment:MOB-1', true));
    first.unmount();
    expect(hasDrafts()).toBe(true);
    second.unmount();
    expect(hasDrafts()).toBe(false);
  });
});
