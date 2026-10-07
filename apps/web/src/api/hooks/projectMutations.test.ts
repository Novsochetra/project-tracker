import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProjectBoard, ProjectDetail, ProjectSummary } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { refreshForChange } from '../live/refreshForChange';
import { queryKeys } from '../queryKeys';
import { makeTicketDetail, otherProject, project, statuses, summaryOf } from '../test/fixtures';
import { cachedBoard, isInvalidated, seedTicket, setupApi } from '../test/render';
import { useBoard } from './projects';
import { useCreateProject, useDeleteProject, useUpdateProject } from './projectMutations';

const listKeys = (list: ProjectSummary[] | undefined) => list?.map((item) => item.key);

describe('useCreateProject', () => {
  it('seeds the new project, its empty board and the list', async () => {
    const detail: ProjectDetail = { project: otherProject, statuses };
    const { queryClient, wrapper } = setupApi({ createProject: vi.fn().mockResolvedValue(detail) });
    queryClient.setQueryData(queryKeys.projects(), [summaryOf(project)]);
    queryClient.setQueryData(queryKeys.ticket('WEB-1'), makeTicketDetail());
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    act(() => result.current.mutate({ name: 'Website' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.project('WEB'))).toEqual(detail);
    expect(cachedBoard(queryClient, 'WEB').tickets).toEqual([]);
    expect(listKeys(queryClient.getQueryData(queryKeys.projects()))).toEqual(['MOB', 'WEB']);
    expect(queryClient.getQueryData(queryKeys.ticket('WEB-1'))).toBeUndefined();
  });
});

describe('useUpdateProject', () => {
  it('patches the project everywhere it is cached', async () => {
    const saved = { ...project, name: 'Phone app', repo: '~/code/phone' };
    const { queryClient, wrapper } = setupApi({ updateProject: vi.fn().mockResolvedValue(saved) });
    seedTicket(queryClient);
    queryClient.setQueryData(queryKeys.projects(), [summaryOf(project)]);
    queryClient.setQueryData<ProjectDetail>(queryKeys.project('MOB'), { project, statuses });
    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    act(() => result.current.mutate({ projectKey: 'MOB', input: { name: 'Phone app' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedBoard(queryClient).project.name).toBe('Phone app');
    expect(queryClient.getQueryData<ProjectDetail>(queryKeys.project('MOB'))?.project.repo).toBe(
      '~/code/phone',
    );
    expect(queryClient.getQueryData<ProjectSummary[]>(queryKeys.projects())?.[0]?.name).toBe(
      'Phone app',
    );
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
  });
});

describe('useDeleteProject', () => {
  it('drops the project from the list and stops refreshing its open screen', async () => {
    const getBoard = vi.fn();
    const { queryClient, wrapper } = setupApi({
      getBoard,
      deleteProject: vi.fn().mockResolvedValue(undefined),
    });
    seedTicket(queryClient);
    queryClient.setQueryData(queryKeys.projects(), [summaryOf(project), summaryOf(otherProject)]);
    const { result } = renderHook(() => ({ board: useBoard('MOB'), remove: useDeleteProject() }), {
      wrapper,
    });

    act(() => result.current.remove.mutate({ projectKey: 'MOB' }));

    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(listKeys(queryClient.getQueryData(queryKeys.projects()))).toEqual(['WEB']);
    act(() =>
      refreshForChange(queryClient, { type: 'changed', projectId: 'p-mob', ticketId: null }),
    );
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
    expect(getBoard).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<ProjectBoard>(queryKeys.board('MOB'))).toBeDefined();
    expect(queryClient.getQueryData(queryKeys.ticket('MOB-1'))).toBeUndefined();
  });
});
