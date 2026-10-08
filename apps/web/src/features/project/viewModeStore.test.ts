import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getViewMode, setViewMode, useViewMode } from './viewModeStore';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('view mode store', () => {
  it('starts on List', () => {
    expect(getViewMode('MOB')).toBe('list');
  });

  it('remembers the choice per project in local storage, whatever the key case', () => {
    setViewMode('mob', 'board');
    expect(window.localStorage.getItem('tracker.projectView.MOB')).toBe('board');
    expect(getViewMode('MOB')).toBe('board');
    expect(getViewMode('WEB')).toBe('list');
  });

  it('reads a choice saved earlier and ignores values it does not know', () => {
    window.localStorage.setItem('tracker.projectView.WEB', 'board');
    window.localStorage.setItem('tracker.projectView.MOB', 'grid');
    expect(getViewMode('web')).toBe('board');
    expect(getViewMode('MOB')).toBe('list');
  });

  it('keeps the choice for the session when storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    setViewMode('MOB', 'board');
    expect(getViewMode('MOB')).toBe('board');
    vi.restoreAllMocks();
    setViewMode('MOB', 'list');
    expect(getViewMode('MOB')).toBe('list');
  });

  it('re-renders subscribers', () => {
    const { result } = renderHook(() => useViewMode('MOB'));
    expect(result.current).toBe('list');
    act(() => setViewMode('MOB', 'board'));
    expect(result.current).toBe('board');
  });
});
