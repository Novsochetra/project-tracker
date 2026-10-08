import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Ticket, TicketListItem } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { listItem, makeBoard, STATUS } from '../test/fixtures';
import { MockEventSource } from '../test/mockEventSource';
import { isInvalidated, setupApi } from '../test/render';
import { useLiveUpdates } from './live';
import { useReadyForYou } from './ready';
import { useMoveTicket, useUpdateTicket } from './ticketEdits';

const reviewed = (num: number) =>
  listItem(num, STATUS.reviewed, num, { lastReview: { verdict: 'approved', rating: 4 } });

const READY = [reviewed(3), reviewed(5)];
const webTicketChanged = { type: 'changed', projectId: 'p-web', ticketId: 't-web-1' };

const cachedReady = (queryClient: QueryClient) =>
  queryClient.getQueryData<TicketListItem[]>(queryKeys.ready())?.map((ticket) => ticket.key);

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.ready(), READY);
  queryClient.setQueryData(queryKeys.board('MOB'), makeBoard(READY));
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReadyForYou', () => {
  it('loads the reviewed tickets of every project', async () => {
    const listAllTickets = vi.fn().mockResolvedValue(READY);
    const { wrapper } = setupApi({ listAllTickets });
    const { result } = renderHook(() => useReadyForYou(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(READY));
    expect(listAllTickets).toHaveBeenCalledWith({ category: 'reviewed' });
  });

  it('refreshes on a change anywhere, like the project list', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });

    act(() => MockEventSource.latest().emit(webTicketChanged));

    expect(isInvalidated(queryClient, queryKeys.ready())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
  });

  it('takes a ticket off at once when it moves to Done, and refreshes once the move is saved', async () => {
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

    act(() => result.current.mutate({ ticketKey: 'MOB-3', input: { statusId: STATUS.done } }));
    await waitFor(() => expect(cachedReady(queryClient)).toEqual(['MOB-5']));
    act(() => MockEventSource.latest().emit(webTicketChanged));
    expect(isInvalidated(queryClient, queryKeys.ready())).toBe(false);

    act(() => request.resolve({ ...READY[0]!, statusId: STATUS.done }));
    await waitFor(() => expect(isInvalidated(queryClient, queryKeys.ready())).toBe(true));
  });

  it('puts the ticket back when the move fails', async () => {
    const { queryClient, wrapper } = setupApi({
      updateTicket: vi.fn().mockRejectedValue(new Error('Database is locked')),
    });
    seed(queryClient);
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-3', input: { statusId: STATUS.done } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedReady(queryClient)).toEqual(['MOB-3', 'MOB-5']);
  });

  it('keeps tickets whose status does not change', async () => {
    const { queryClient, wrapper } = setupApi({
      updateTicket: vi.fn(() => new Promise(() => undefined)),
      moveTicket: vi.fn(() => new Promise(() => undefined)),
    });
    seed(queryClient);
    const { result } = renderHook(() => ({ update: useUpdateTicket(), move: useMoveTicket() }), {
      wrapper,
    });

    act(() => result.current.update.mutate({ ticketKey: 'MOB-3', input: { title: 'Renamed' } }));
    act(() =>
      result.current.move.mutate({
        ticketKey: 'MOB-5',
        input: { statusId: STATUS.reviewed, beforeId: 't-3', afterId: null },
      }),
    );

    await waitFor(() => expect(queryClient.isMutating()).toBe(2));
    expect(cachedReady(queryClient)).toEqual(['MOB-3', 'MOB-5']);
  });

  it('takes a ticket off when a drag moves it to another status', async () => {
    const { queryClient, wrapper } = setupApi({
      moveTicket: vi.fn(() => new Promise(() => undefined)),
    });
    seed(queryClient);
    const { result } = renderHook(() => useMoveTicket(), { wrapper });

    act(() =>
      result.current.mutate({
        ticketKey: 'MOB-5',
        input: { statusId: STATUS.done, beforeId: null, afterId: null },
      }),
    );

    await waitFor(() => expect(cachedReady(queryClient)).toEqual(['MOB-3']));
  });
});
