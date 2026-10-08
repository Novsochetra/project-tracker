import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expandGroup, isExpanded, toggleExpanded, useIsExpanded } from './expandedStore';

describe('expanded groups', () => {
  it('toggles per project and status', () => {
    toggleExpanded('MOB', 's-todo');
    expect(isExpanded('mob', 's-todo')).toBe(true);
    expect(isExpanded('MOB', 's-done')).toBe(false);
    expect(isExpanded('WEB', 's-todo')).toBe(false);
    toggleExpanded('MOB', 's-todo');
    expect(isExpanded('MOB', 's-todo')).toBe(false);
  });

  it('expands without collapsing an expanded group', () => {
    expandGroup('MOB', 's-review');
    expandGroup('MOB', 's-review');
    expect(isExpanded('MOB', 's-review')).toBe(true);
  });

  it('re-renders subscribers', () => {
    const { result } = renderHook(() => useIsExpanded('MOB', 's-progress'));
    expect(result.current).toBe(false);
    act(() => toggleExpanded('MOB', 's-progress'));
    expect(result.current).toBe(true);
  });
});
