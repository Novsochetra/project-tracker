import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  appearanceChoice,
  setAppearanceChoice,
  useAppearanceChoice,
} from './appearanceSetting';

afterEach(() => {
  vi.restoreAllMocks();
  setAppearanceChoice('system');
  localStorage.clear();
});

describe('appearance setting', () => {
  it('follows the system until the person picks Light or Dark', () => {
    localStorage.clear();
    expect(appearanceChoice()).toBe('system');
  });

  it('keeps the choice for the next visit', () => {
    setAppearanceChoice('dark');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(appearanceChoice()).toBe('dark');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'sepia');
    expect(appearanceChoice()).toBe('system');
  });

  it('still holds the choice for this visit when storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    setAppearanceChoice('light');
    expect(appearanceChoice()).toBe('light');
  });

  it('tells every control on screen', () => {
    const { result } = renderHook(() => useAppearanceChoice());
    expect(result.current).toBe('system');
    act(() => setAppearanceChoice('dark'));
    expect(result.current).toBe('dark');
  });
});
