import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { STATUS, statuses } from '../../api/test/fixtures';
import {
  DEFAULT_LIST_VIEW,
  getListView,
  hidesNewTicket,
  pickedLabel,
  resetListView,
  setListFilter,
  setListLabel,
  setListQuery,
  useListView,
} from './listViewStore';

const view = (filter: string, query: string) => ({ filter, query, label: null });

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
    expect(getListView('MOB')).toEqual({ filter: STATUS.done, query: 'crash', label: null });
    expect(getListView('WEB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('resets to All and an empty search', () => {
    setListFilter('MOB', STATUS.progress);
    resetListView('MOB');
    expect(getListView('MOB')).toEqual(DEFAULT_LIST_VIEW);
  });

  it('keeps the picked label, which a reset clears', () => {
    setListLabel('MOB', 'l-bug');
    expect(getListView('MOB').label).toBe('l-bug');
    resetListView('MOB');
    expect(getListView('MOB').label).toBeNull();
  });

  it('shows every ticket once the picked label is gone', () => {
    setListLabel('MOB', 'l-gone');
    expect(pickedLabel(getListView('MOB'), [{ id: 'l-bug' }])).toBeUndefined();
    expect(pickedLabel(getListView('MOB'), [{ id: 'l-gone' }])).toEqual({ id: 'l-gone' });
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
    expect(hidesNewTicket(view(STATUS.done, ''), statuses, { statusId: STATUS.todo })).toBe(true);
    expect(hidesNewTicket(view(STATUS.todo, ''), statuses, { statusId: STATUS.done })).toBe(true);
  });

  it("is false on All and on the new ticket's own status", () => {
    expect(hidesNewTicket(view('all', ''), statuses, { statusId: STATUS.todo })).toBe(false);
    expect(hidesNewTicket(view(STATUS.done, ''), statuses, { statusId: STATUS.done })).toBe(false);
    expect(hidesNewTicket(view(STATUS.todo, '  '), statuses, { statusId: STATUS.todo })).toBe(
      false,
    );
  });

  it('is false when the picked status was deleted, since the list shows All then', () => {
    const left = statuses.filter((status) => status.id !== STATUS.review);
    expect(hidesNewTicket(view(STATUS.review, ''), left, { statusId: STATUS.todo })).toBe(false);
  });

  it('is true while a search is active', () => {
    expect(hidesNewTicket(view('all', 'crash'), statuses, { statusId: STATUS.todo })).toBe(true);
  });

  it('is true when the list shows a label the new ticket lacks', () => {
    const labelled = { ...view('all', ''), label: 'l-bug' };
    expect(hidesNewTicket(labelled, statuses, { statusId: STATUS.todo })).toBe(true);
    const bug = { statusId: STATUS.todo, labelIds: ['l-bug'] };
    expect(hidesNewTicket(labelled, statuses, bug)).toBe(false);
  });
});
