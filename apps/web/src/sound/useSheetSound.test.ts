import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playSound } from './play';
import { useSheetSound } from './useSheetSound';

vi.mock('./play', () => ({ playSound: vi.fn() }));

beforeEach(() => {
  vi.mocked(playSound).mockClear();
});

describe('useSheetSound', () => {
  it('sounds as the sheet comes up and as it goes', () => {
    const { rerender } = renderHook(({ open }) => useSheetSound(open), {
      initialProps: { open: true },
    });
    expect(playSound).toHaveBeenLastCalledWith('sheetOpen');
    rerender({ open: false });
    expect(playSound).toHaveBeenLastCalledWith('sheetClose');
    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it('stays quiet for a sheet mounted closed and for renders that change nothing', () => {
    const { rerender } = renderHook(({ open }) => useSheetSound(open), {
      initialProps: { open: false },
    });
    rerender({ open: false });
    expect(playSound).not.toHaveBeenCalled();
  });

  it('lets an action sheet sound only as it comes up', () => {
    const { rerender } = renderHook(({ open }) => useSheetSound(open, { onClose: false }), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith('sheetOpen');
  });
});
