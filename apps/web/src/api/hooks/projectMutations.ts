import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateProjectInput,
  Project,
  ProjectBoard,
  ProjectDetail,
  ProjectSummary,
  UpdateProjectInput,
} from '@tracker/shared';
import {
  appendProjectSummary,
  patchProjectSummary,
  removeProjectSummary,
  withProject,
} from '../cache/projects';
import { useApi } from '../context';
import { forgetDeleted, markDeleted } from '../deleted';
import { cacheChange, patchCaches } from '../optimistic';
import { belongsToProject, queryKeys } from '../queryKeys';
import { settleMutation } from '../refresh';
import type { TrackerMutation } from '../types';

export interface UpdateProjectVariables {
  projectKey: string;
  input: UpdateProjectInput;
}

export interface DeleteProjectVariables {
  projectKey: string;
}

const refreshProjectList = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects(), exact: true });
};

// A deleted project's key can be reused, so drop anything cached under it before seeding.
function seedProject(queryClient: QueryClient, detail: ProjectDetail): Promise<void> {
  const key = detail.project.key;
  forgetDeleted(queryClient, key);
  queryClient.removeQueries({ predicate: ({ queryKey }) => belongsToProject(queryKey, key) });
  queryClient.setQueryData<ProjectDetail>(queryKeys.project(key), detail);
  queryClient.setQueryData<ProjectBoard>(queryKeys.board(key), { ...detail, tickets: [] });
  return patchCaches(queryClient, [
    cacheChange<ProjectSummary[]>(queryKeys.projects(), (list) =>
      appendProjectSummary(list, detail.project),
    ),
  ]);
}

const projectChanges = (project: Project) => [
  cacheChange<ProjectSummary[]>(queryKeys.projects(), (list) => patchProjectSummary(list, project)),
  cacheChange<ProjectDetail>(queryKeys.project(project.key), (data) => withProject(data, project)),
  cacheChange<ProjectBoard>(queryKeys.board(project.key), (data) => withProject(data, project)),
];

export function useCreateProject(): TrackerMutation<ProjectDetail, CreateProjectInput> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => client.createProject(input),
    onSuccess: (detail) => seedProject(queryClient, detail),
    onSettled: () => refreshProjectList(queryClient),
  });
}

export function useUpdateProject(): TrackerMutation<Project, UpdateProjectVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: UpdateProjectVariables) =>
      client.updateProject(projectKey, input),
    onSuccess: (project) => patchCaches(queryClient, projectChanges(project)),
    onSettled: (_project, _error, variables) =>
      settleMutation(queryClient, variables, { withTickets: true }),
  });
}

export function useDeleteProject(): TrackerMutation<void, DeleteProjectVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey }: DeleteProjectVariables) => client.deleteProject(projectKey),
    onSuccess: (_result, { projectKey }) => {
      markDeleted(queryClient, projectKey);
      queryClient.removeQueries({
        predicate: ({ queryKey }) => belongsToProject(queryKey, projectKey),
        type: 'inactive',
      });
      return patchCaches(queryClient, [
        cacheChange<ProjectSummary[]>(queryKeys.projects(), (list) =>
          removeProjectSummary(list, projectKey),
        ),
      ]);
    },
    onSettled: () => refreshProjectList(queryClient),
  });
}
