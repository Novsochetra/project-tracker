import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_VIEW,
  getListView,
  hidesNewTicket,
  resetListView,
  setListFilter,
  setListQuery,
  useListView,
} from './listViewStore';

afterEach(() => {
  resetListView('MOB');
  resetListView('WEB');
});

describe('list view store', () => {
  it('starts on All with no search', () => {
    expect(getListView('MOB')).toBe(DEFAULT_LIST_VIEW);
  });

  it('keeps the filter and search per project, whatever the key case', () => {
    setListFilter('mob', 'done');
    setListQuery('MOB', 'crash');
    expect(getListView('MOB')).toEqual({ filter: 'done', query: 'crash' });
    expect(getListView('WEB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('resets to All and an empty search', () => {
    setListFilter('MOB', 'active');
    resetListView('MOB');
    expect(getListView('MOB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('re-renders subscribers', () => {
    const { result } = renderHook(() => useListView('MOB'));
    act(() => setListFilter('MOB', 'done'));
    expect(result.current.filter).toBe('done');
    act(() => resetListView('MOB'));
    expect(result.current).toEqual(DEFAULT_LIST_VIEW);
  });
});

describe('hidesNewTicket', () => {
  it('is true when the filter would hide the new ticket', () => {
    expect(hidesNewTicket({ filter: 'done', query: '' }, false)).toBe(true);
    expect(hidesNewTicket({ filter: 'active', query: '' }, true)).toBe(true);
  });

  it('is false when the new ticket shows under the filter', () => {
    expect(hidesNewTicket({ filter: 'all', query: '' }, false)).toBe(false);
    expect(hidesNewTicket({ filter: 'done', query: '' }, true)).toBe(false);
    expect(hidesNewTicket({ filter: 'active', query: '  ' }, false)).toBe(false);
  });

  it('is true while a search is active', () => {
    expect(hidesNewTicket({ filter: 'all', query: 'crash' }, false)).toBe(true);
  });
});
