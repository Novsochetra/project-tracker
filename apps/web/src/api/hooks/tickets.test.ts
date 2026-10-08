import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { ProjectDetail, Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { markWritten } from '../freshReads';
import { refreshForChange } from '../live/refreshForChange';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { listItem, makeTicketDetail, project, STATUS, statuses, summaryOf } from '../test/fixtures';
import {
  boardTicket,
  cachedBoard,
  cachedTicket,
  isInvalidated,
  seedTicket,
  setupApi,
} from '../test/render';
import { useUpdateTicket } from './ticketEdits';
import { useDeleteTicket, useMarkSent, useTicket, useCreateTicket } from './tickets';

const ticketOf = (num: number, statusId: string, rank: number): Ticket => {
  const { commentCount: _c, attachmentCount: _a, ...ticket } = listItem(num, statusId, rank);
  return ticket;
};

describe('useCreateTicket', () => {
  it('puts the created ticket on the board and moves the next number on', async () => {
    const created = ticketOf(5, STATUS.todo, -1000);
    const { queryClient, wrapper } = setupApi({ createTicket: vi.fn().mockResolvedValue(created) });
    seedTicket(queryClient);
    queryClient.setQueryData<ProjectDetail>(queryKeys.project('MOB'), { project, statuses });
    queryClient.setQueryData(queryKeys.projects(), [summaryOf(project)]);
    const { result } = renderHook(() => useCreateTicket(), { wrapper });

    act(() =>
      result.current.mutate({
        projectKey: 'MOB',
        input: { title: 'Ticket 5', attachmentIds: ['img-1'] },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(boardTicket(queryClient, 'MOB-5')).toMatchObject({ rank: -1000, attachmentCount: 1 });
    expect(cachedBoard(queryClient).project.nextNum).toBe(6);
    expect(queryClient.getQueryData<ProjectDetail>(queryKeys.project('MOB'))?.project.nextNum).toBe(
      6,
    );
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
  });
});

describe('useDeleteTicket', () => {
  it('removes the row at once and puts it back when the delete fails', async () => {
    const request = deferred<void>();
    const { queryClient, wrapper } = setupApi({ deleteTicket: vi.fn(() => request.promise) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useDeleteTicket(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-2' }));
    await waitFor(() =>
      expect(cachedBoard(queryClient).tickets.map((ticket) => ticket.key)).not.toContain('MOB-2'),
    );

    request.reject(new ApiError(404, 'not_found', 'Ticket was not found.'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(boardTicket(queryClient, 'MOB-2').key).toBe('MOB-2');
  });

  it('stops live refreshes from refetching a deleted ticket that is still on screen', async () => {
    const getTicket = vi.fn();
    const { queryClient, wrapper } = setupApi({
      getTicket,
      deleteTicket: vi.fn().mockResolvedValue(undefined),
    });
    seedTicket(queryClient);
    const { result } = renderHook(
      () => ({ ticket: useTicket('MOB-1'), remove: useDeleteTicket() }),
      {
        wrapper,
      },
    );

    act(() => result.current.remove.mutate({ ticketKey: 'MOB-1' }));
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    act(() =>
      refreshForChange(queryClient, { type: 'changed', projectId: 'p-mob', ticketId: 't-1' }),
    );

    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(getTicket).not.toHaveBeenCalled();
  });
});

describe('useMarkSent', () => {
  it('writes the ticket the server returns into the board and the detail', async () => {
    const moved = ticketOf(1, STATUS.progress, -1000);
    const { queryClient, wrapper } = setupApi({ markSent: vi.fn().mockResolvedValue(moved) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useMarkSent(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { moveToInProgress: true } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(boardTicket(queryClient, 'MOB-1')).toMatchObject({
      statusId: STATUS.progress,
      rank: -1000,
    });
    expect(cachedTicket(queryClient).status.id).toBe(STATUS.progress);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });
});

describe('useTicket', () => {
  // The copy the service worker saved before the write would otherwise put the old text back on
  // screen when the read is slow.
  it('reads the ticket from the tracker itself after a write, until such a read lands', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({
      getTicket,
      updateTicket: vi.fn().mockResolvedValue(detail.ticket),
    });
    seedTicket(queryClient, detail);
    const { result } = renderHook(
      () => ({ ticket: useTicket('MOB-1'), update: useUpdateTicket() }),
      { wrapper },
    );

    await act(() =>
      result.current.update.mutateAsync({ ticketKey: 'MOB-1', input: { description: 'Steps' } }),
    );
    await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(1));
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });

    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.ticket('MOB-1') }));
    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1');
  });

  it('reads a written ticket it has no copy of as usual, so a saved copy can still show', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({ getTicket });
    markWritten(queryClient, 'MOB-1');
    const { result } = renderHook(() => useTicket('MOB-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(detail));
    expect(getTicket).toHaveBeenCalledWith('MOB-1');
  });

  it('keeps reading fresh after a write while those reads fail', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    getTicket.mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({
      getTicket,
      updateTicket: vi.fn().mockResolvedValue(detail.ticket),
    });
    seedTicket(queryClient, detail);
    const { result } = renderHook(
      () => ({ ticket: useTicket('MOB-1'), update: useUpdateTicket() }),
      { wrapper },
    );

    await act(() =>
      result.current.update.mutateAsync({ ticketKey: 'MOB-1', input: { description: 'Steps' } }),
    );
    await waitFor(() => expect(result.current.ticket.isError).toBe(true));
    expect(result.current.ticket.data?.ticket.description).toBe('Steps');
    await act(() => result.current.ticket.refetch());
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });
  });
});
