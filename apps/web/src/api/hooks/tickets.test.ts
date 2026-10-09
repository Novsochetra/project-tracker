import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { ProjectDetail, Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { markChanged } from '../freshReads';
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

  it('counts only the files a repeated create attached, and keeps its answer off the board', async () => {
    const created = { ...ticketOf(5, STATUS.todo, -1000), leftOutAttachmentIds: ['img-2'] };
    const { queryClient, wrapper } = setupApi({ createTicket: vi.fn().mockResolvedValue(created) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useCreateTicket(), { wrapper });

    act(() =>
      result.current.mutate({
        projectKey: 'MOB',
        input: { title: 'Ticket 5', attachmentIds: ['img-1', 'img-2'], clientId: 'c-1' },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.leftOutAttachmentIds).toEqual(['img-2']);
    expect(boardTicket(queryClient, 'MOB-5')).toMatchObject({ attachmentCount: 1 });
    expect(boardTicket(queryClient, 'MOB-5')).not.toHaveProperty('leftOutAttachmentIds');
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

  // After a reload the page has no copy, and the service worker's may be older than the change.
  it('reads a changed ticket it has no copy of fresh as well', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({ getTicket });
    markChanged(queryClient, 'MOB-1');
    const { result } = renderHook(() => useTicket('MOB-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(detail));
    expect(getTicket.mock.calls).toEqual([['MOB-1', { fresh: true }]]);
  });

  it('shows a saved copy of a changed ticket it has no copy of when the tracker cannot be reached', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    getTicket.mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({ getTicket });
    markChanged(queryClient, 'MOB-1');
    const { result } = renderHook(() => useTicket('MOB-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(detail));
    expect(getTicket.mock.calls).toEqual([['MOB-1', { fresh: true }], ['MOB-1']]);

    await act(() => result.current.refetch());
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });
  });

  it('does not take a saved copy for a ticket the tracker says is gone', async () => {
    const getTicket = vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Not found.'));
    const { queryClient, wrapper } = setupApi({ getTicket });
    markChanged(queryClient, 'MOB-1');
    const { result } = renderHook(() => useTicket('MOB-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getTicket).toHaveBeenCalledTimes(1);
  });

  // A saved copy can't hold the change that caused a live update.
  it('reads the ticket fresh when a live update reports a change to it', async () => {
    const detail = makeTicketDetail();
    const getTicket = vi.fn().mockResolvedValue(detail);
    const { queryClient, wrapper } = setupApi({ getTicket });
    seedTicket(queryClient, detail);
    renderHook(() => useTicket('MOB-1'), { wrapper });

    act(() =>
      refreshForChange(queryClient, { type: 'changed', projectId: 'p-mob', ticketId: 't-1' }),
    );
    await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(1));
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });

    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.ticket('MOB-1') }));
    expect(getTicket).toHaveBeenLastCalledWith('MOB-1');
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
