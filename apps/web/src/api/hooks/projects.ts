import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectBoard, ProjectDetail, ProjectSummary } from '@tracker/shared';
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

export function useBoard(projectKey: string): TrackerQuery<ProjectBoard> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.board(projectKey),
    queryFn: () => client.getBoard(projectKey),
  });
}
