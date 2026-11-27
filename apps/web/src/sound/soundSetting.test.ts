import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSoundsOn, SOUND_STORAGE_KEY, soundsOn, useSoundsOn } from './soundSetting';

afterEach(() => {
  vi.restoreAllMocks();
  setSoundsOn(true);
  localStorage.clear();
});

describe('sound setting', () => {
  it('is on until the person turns it off', () => {
    localStorage.clear();
    expect(soundsOn()).toBe(true);
  });

  it('keeps the choice for the next visit', () => {
    setSoundsOn(false);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');
    expect(soundsOn()).toBe(false);
  });

  it('still holds the choice for this visit when storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    setSoundsOn(false);
    expect(soundsOn()).toBe(false);
  });

  it('tells every switch on screen', () => {
    const { result } = renderHook(() => useSoundsOn());
    expect(result.current).toBe(true);
    act(() => setSoundsOn(false));
    expect(result.current).toBe(false);
  });
});
