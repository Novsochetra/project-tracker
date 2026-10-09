import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Ticket } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLiveRefreshPending } from '../live/refreshPending';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { makeBoard, makeTicketDetail, otherProject, project, summaryOf } from '../test/fixtures';
import { MockEventSource } from '../test/mockEventSource';
import { isInvalidated, setupApi } from '../test/render';
import { useLiveUpdates } from './live';
import { useUpdateTicket } from './ticketEdits';

const mobTicketChanged = { type: 'changed', projectId: 'p-mob', ticketId: 't-1' };

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.projects(), [summaryOf(project), summaryOf(otherProject)]);
  queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  queryClient.setQueryData(queryKeys.board('WEB'), { ...makeBoard([]), project: otherProject });
  queryClient.setQueryData(queryKeys.ticket('MOB-1'), makeTicketDetail());
  queryClient.setQueryData(queryKeys.session(), { authRequired: false, authenticated: true });
}

describe('useLiveUpdates', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the list and the cached board and ticket the event points at', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });

    act(() => MockEventSource.latest().emit(mobTicketChanged));

    expect(MockEventSource.latest().url).toBe('/api/events');
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.session())).toBe(false);
  });

  it('leaves a ticket alone while one of its edits is still saving', async () => {
    const request = deferred<Ticket>();
    const { queryClient, wrapper } = setupApi({ updateTicket: vi.fn(() => request.promise) });
    seed(queryClient);
    const { result } = renderHook(
      () => {
        useLiveUpdates();
        return useUpdateTicket();
      },
      { wrapper },
    );

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'Typing' } }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));
    act(() => MockEventSource.latest().emit(mobTicketChanged));

    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
  });

  it('refreshes everything after a reconnect', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();

    act(() => source.open());
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    act(() => {
      source.fail(false);
      source.open();
    });

    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.session())).toBe(false);
  });

  it('holds focus reads from a drop until the reopened stream opens, and not once stopped', () => {
    const { queryClient, wrapper } = setupApi();
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    act(() => source.open());
    expect(isLiveRefreshPending(queryClient)).toBe(false);

    act(() => source.fail(false));
    expect(isLiveRefreshPending(queryClient)).toBe(true);
    act(() => source.open());
    expect(isLiveRefreshPending(queryClient)).toBe(false);

    act(() => source.fail(false));
    unmount();
    expect(isLiveRefreshPending(queryClient)).toBe(false);
  });

  it('signs out when the server refuses the stream because the session is gone', async () => {
    const signedOut = { authRequired: true, authenticated: false };
    const getSession = vi.fn().mockResolvedValue(signedOut);
    const { queryClient, wrapper } = setupApi({ getSession });
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    act(() => source.open());

    act(() => source.fail(true));

    await waitFor(() => expect(queryClient.getQueryData(queryKeys.session())).toEqual(signedOut));
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('reopens a stream waiting to reopen as soon as the tracker answers again', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    let unreachable = true;
    const listeners = new Set<() => void>();
    const tracker = {
      isUnreachable: () => unreachable,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    renderHook(() => useLiveUpdates(tracker), { wrapper });
    act(() => MockEventSource.latest().fail(true));

    act(() => {
      unreachable = false;
      listeners.forEach((listener) => listener());
    });
    expect(MockEventSource.instances).toHaveLength(2);
    act(() => MockEventSource.latest().open());

    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
  });

  it('closes the stream on unmount', () => {
    const { wrapper } = setupApi();
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    unmount();
    expect(source.readyState).toBe(MockEventSource.CLOSED);
  });
});
