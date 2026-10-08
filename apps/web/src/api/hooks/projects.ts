import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import type { ProjectBoard, ProjectDetail, ProjectSummary } from '@tracker/shared';
import { useCallback } from 'react';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

const detailOf = (board: ProjectBoard | undefined): ProjectDetail | undefined =>
  board && { project: board.project, statuses: board.statuses };

export function useProjects(): TrackerQuery<ProjectSummary[]> {
  const client = useApi();
  return useQuery({ queryKey: queryKeys.projects(), queryFn: () => client.listProjects() });
}

export function useProject(projectKey: string): TrackerQuery<ProjectDetail> {
  const client = useApi();
  const queryClient = useQueryClient();
  const boardKey = queryKeys.board(projectKey);
  return useQuery({
    queryKey: queryKeys.project(projectKey),
    queryFn: () => client.getProject(projectKey),
    initialData: () => detailOf(queryClient.getQueryData<ProjectBoard>(boardKey)),
    initialDataUpdatedAt: () => queryClient.getQueryState(boardKey)?.dataUpdatedAt,
  });
}

const boardQuery = (client: TrackerClient, projectKey: string) =>
  queryOptions({
    queryKey: queryKeys.board(projectKey),
    queryFn: () => client.getBoard(projectKey),
  });

export function useBoard(projectKey: string): TrackerQuery<ProjectBoard> {
  return useQuery(boardQuery(useApi(), projectKey));
}

// The screen's useBoard joins this read while it is on its way and uses its answer for the stale
// time after, so the board is read once.
export function usePrefetchBoard(): (projectKey: string) => void {
  const client = useApi();
  const queryClient = useQueryClient();
  return useCallback(
    (projectKey: string) => void queryClient.prefetchQuery(boardQuery(client, projectKey)),
    [client, queryClient],
  );
}
