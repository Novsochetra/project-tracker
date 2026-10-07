import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { Ticket, UpdateTicketInput } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../errors';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { listItem, STATUS } from '../test/fixtures';
import { boardTicket, cachedTicket, isInvalidated, seedTicket, setupApi } from '../test/render';
import { useMoveTicket, useUpdateTicket } from './ticketEdits';

const { commentCount: _c, attachmentCount: _a, ...savedTicket } = listItem(1, STATUS.todo, 0);
const serverTicket: Ticket = savedTicket;

describe('useUpdateTicket', () => {
  it('moves a status change to the top of its new group at once, then refreshes', async () => {
    const request = deferred<Ticket>();
    const { queryClient, wrapper } = setupApi({ updateTicket: vi.fn(() => request.promise) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { statusId: STATUS.progress } }));

    await waitFor(() => expect(boardTicket(queryClient, 'MOB-1').statusId).toBe(STATUS.progress));
    expect(boardTicket(queryClient, 'MOB-1').rank).toBe(-1000);
    expect(cachedTicket(queryClient).status.id).toBe(STATUS.progress);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);

    request.resolve({ ...serverTicket, statusId: STATUS.progress, rank: -1000 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });

  it('rolls back the board and the ticket when the request fails', async () => {
    const updateTicket = vi.fn().mockRejectedValue(new ApiError(400, 'invalid_input', 'Too long.'));
    const { queryClient, wrapper } = setupApi({ updateTicket });
    seedTicket(queryClient);
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'Changed' } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(boardTicket(queryClient, 'MOB-1').title).toBe('Ticket 1');
    expect(cachedTicket(queryClient).ticket.title).toBe('Ticket 1');
    expect(errorMessage(result.current.error)).toBe('Too long.');
  });

  it('waits for the last pending edit of a ticket before refreshing it', async () => {
    const first = deferred<Ticket>();
    const second = deferred<Ticket>();
    const updateTicket = vi.fn((_key: string, input: UpdateTicketInput) =>
      input.title === 'A' ? first.promise : second.promise,
    );
    const { queryClient, wrapper } = setupApi({ updateTicket });
    seedTicket(queryClient);
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => {
      result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'A' } });
      result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'AB' } });
    });
    await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(2));
    expect(cachedTicket(queryClient).ticket.title).toBe('AB');

    first.resolve({ ...serverTicket, title: 'A' });
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(cachedTicket(queryClient).ticket.title).toBe('AB');

    second.resolve({ ...serverTicket, title: 'AB' });
    await waitFor(() => expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true));
  });
});

describe('useMoveTicket', () => {
  it('applies the drop to the board at once and rolls back on failure', async () => {
    const request = deferred<Ticket>();
    const { queryClient, wrapper } = setupApi({ moveTicket: vi.fn(() => request.promise) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useMoveTicket(), { wrapper });

    act(() =>
      result.current.mutate({
        ticketKey: 'MOB-2',
        input: { statusId: STATUS.progress, beforeId: 't-3' },
      }),
    );

    await waitFor(() => expect(boardTicket(queryClient, 'MOB-2').statusId).toBe(STATUS.progress));
    expect(boardTicket(queryClient, 'MOB-2').rank).toBe(0);
    expect(boardTicket(queryClient, 'MOB-3').rank).toBe(1000);

    request.reject(new TypeError('Failed to fetch'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(boardTicket(queryClient, 'MOB-2')).toMatchObject({ statusId: STATUS.todo, rank: 1000 });
    expect(boardTicket(queryClient, 'MOB-3').rank).toBe(0);
  });

  it('keeps the ticket detail status in step with the move', async () => {
    const { queryClient, wrapper } = setupApi({
      moveTicket: vi.fn().mockResolvedValue({ ...serverTicket, statusId: STATUS.done }),
    });
    seedTicket(queryClient);
    const { result } = renderHook(() => useMoveTicket(), { wrapper });
    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { statusId: STATUS.done } }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedTicket(queryClient).ticket.statusId).toBe(STATUS.done);
    expect(cachedTicket(queryClient).status.id).toBe(STATUS.done);
  });
});
