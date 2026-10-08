import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { STATUS, statuses } from '../../api/test/fixtures';
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
    setListFilter('mob', STATUS.done);
    setListQuery('MOB', 'crash');
    expect(getListView('MOB')).toEqual({ filter: STATUS.done, query: 'crash' });
    expect(getListView('WEB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('resets to All and an empty search', () => {
    setListFilter('MOB', STATUS.progress);
    resetListView('MOB');
    expect(getListView('MOB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('re-renders subscribers', () => {
    const { result } = renderHook(() => useListView('MOB'));
    act(() => setListFilter('MOB', STATUS.done));
    expect(result.current.filter).toBe(STATUS.done);
    act(() => resetListView('MOB'));
    expect(result.current).toEqual(DEFAULT_LIST_VIEW);
  });
});

describe('hidesNewTicket', () => {
  it("is true when the tab shows another status than the new ticket's", () => {
    expect(hidesNewTicket({ filter: STATUS.done, query: '' }, statuses, STATUS.todo)).toBe(true);
    expect(hidesNewTicket({ filter: STATUS.todo, query: '' }, statuses, STATUS.done)).toBe(true);
  });

  it("is false on All and on the new ticket's own status", () => {
    expect(hidesNewTicket({ filter: 'all', query: '' }, statuses, STATUS.todo)).toBe(false);
    expect(hidesNewTicket({ filter: STATUS.done, query: '' }, statuses, STATUS.done)).toBe(false);
    expect(hidesNewTicket({ filter: STATUS.todo, query: '  ' }, statuses, STATUS.todo)).toBe(false);
  });

  it('is false when the picked status was deleted, since the list shows All then', () => {
    const left = statuses.filter((status) => status.id !== STATUS.review);
    expect(hidesNewTicket({ filter: STATUS.review, query: '' }, left, STATUS.todo)).toBe(false);
  });

  it('is true while a search is active', () => {
    expect(hidesNewTicket({ filter: 'all', query: 'crash' }, statuses, STATUS.todo)).toBe(true);
  });
});
