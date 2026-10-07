import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { ProjectDetail, Status } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { project, STATUS, statuses } from '../test/fixtures';
import { cachedBoard, isInvalidated, seedTicket, setupApi } from '../test/render';
import { useCreateStatus, useDeleteStatus, useReorderStatuses, useUpdateStatus } from './statuses';

const order = [STATUS.done, STATUS.todo, STATUS.progress, STATUS.review, STATUS.reviewed];

const statusIds = (list: Status[]) => list.map((status) => status.id);

describe('useReorderStatuses', () => {
  it('reorders the board and project at once and rolls back on failure', async () => {
    const request = deferred<Status[]>();
    const { queryClient, wrapper } = setupApi({ reorderStatuses: vi.fn(() => request.promise) });
    seedTicket(queryClient);
    queryClient.setQueryData<ProjectDetail>(queryKeys.project('MOB'), { project, statuses });
    const { result } = renderHook(() => useReorderStatuses(), { wrapper });

    act(() => result.current.mutate({ projectKey: 'MOB', ids: order }));

    await waitFor(() => expect(statusIds(cachedBoard(queryClient).statuses)).toEqual(order));
    const detail = queryClient.getQueryData<ProjectDetail>(queryKeys.project('MOB'));
    expect(statusIds(detail?.statuses ?? [])).toEqual(order);

    request.reject(new ApiError(400, 'invalid_input', 'List every status.'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(statusIds(cachedBoard(queryClient).statuses)).toEqual(statusIds(statuses));
  });
});

describe('status edits', () => {
  it('adds a created status and refreshes the project and its tickets', async () => {
    const created: Status = { ...statuses[0]!, id: 's-blocked', name: 'Blocked', position: 5 };
    const { queryClient, wrapper } = setupApi({ createStatus: vi.fn().mockResolvedValue(created) });
    seedTicket(queryClient);
    const { result } = renderHook(() => useCreateStatus(), { wrapper });

    act(() =>
      result.current.mutate({ projectKey: 'MOB', input: { name: 'Blocked', category: 'todo' } }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedBoard(queryClient).statuses.at(-1)?.name).toBe('Blocked');
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });

  it('renames a status in place', async () => {
    const renamed: Status = { ...statuses[0]!, name: 'Backlog' };
    const updateStatus = vi.fn().mockResolvedValue(renamed);
    const { queryClient, wrapper } = setupApi({ updateStatus });
    seedTicket(queryClient);
    const { result } = renderHook(() => useUpdateStatus(), { wrapper });

    act(() =>
      result.current.mutate({
        projectKey: 'MOB',
        statusId: STATUS.todo,
        input: { name: 'Backlog' },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateStatus).toHaveBeenCalledWith(STATUS.todo, { name: 'Backlog' });
    expect(cachedBoard(queryClient).statuses[0]?.name).toBe('Backlog');
  });

  it('deletes a status with a target and refreshes', async () => {
    const deleteStatus = vi.fn().mockResolvedValue(undefined);
    const { queryClient, wrapper } = setupApi({ deleteStatus });
    seedTicket(queryClient);
    const { result } = renderHook(() => useDeleteStatus(), { wrapper });

    act(() =>
      result.current.mutate({ projectKey: 'MOB', statusId: STATUS.review, moveTo: STATUS.todo }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteStatus).toHaveBeenCalledWith(STATUS.review, STATUS.todo);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
  });
});
