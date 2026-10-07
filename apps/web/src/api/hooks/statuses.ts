import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateStatusInput,
  ProjectBoard,
  ProjectDetail,
  Status,
  UpdateStatusInput,
} from '@tracker/shared';
import { reorderStatusList, upsertStatus, withStatuses } from '../cache/statuses';
import { useApi } from '../context';
import {
  applyOptimistic,
  cacheChange,
  patchCaches,
  rollbackOnError,
  type CacheChange,
} from '../optimistic';
import { queryKeys } from '../queryKeys';
import { settleMutation } from '../refresh';
import type { TrackerMutation } from '../types';

export interface CreateStatusVariables {
  projectKey: string;
  input: CreateStatusInput;
}

export interface UpdateStatusVariables {
  projectKey: string;
  statusId: string;
  input: UpdateStatusInput;
}

export interface ReorderStatusesVariables {
  projectKey: string;
  ids: string[];
}

export interface DeleteStatusVariables {
  projectKey: string;
  statusId: string;
  moveTo?: string;
}

const statusChanges = (
  projectKey: string,
  update: (statuses: Status[]) => Status[],
): CacheChange[] => [
  cacheChange<ProjectDetail>(queryKeys.project(projectKey), (data) => withStatuses(data, update)),
  cacheChange<ProjectBoard>(queryKeys.board(projectKey), (data) => withStatuses(data, update)),
];

// Ticket details carry the status list too, so they refresh along with the project.
const settleStatuses = (queryClient: QueryClient, variables: { projectKey: string }) =>
  settleMutation(queryClient, variables, { withTickets: true });

export function useCreateStatus(): TrackerMutation<Status, CreateStatusVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: CreateStatusVariables) =>
      client.createStatus(projectKey, input),
    onSuccess: (status, { projectKey }) =>
      patchCaches(
        queryClient,
        statusChanges(projectKey, (list) => upsertStatus(list, status)),
      ),
    onSettled: (_status, _error, variables) => settleStatuses(queryClient, variables),
  });
}

export function useUpdateStatus(): TrackerMutation<Status, UpdateStatusVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statusId, input }: UpdateStatusVariables) =>
      client.updateStatus(statusId, input),
    onSuccess: (status, { projectKey }) =>
      patchCaches(
        queryClient,
        statusChanges(projectKey, (list) => upsertStatus(list, status)),
      ),
    onSettled: (_status, _error, variables) => settleStatuses(queryClient, variables),
  });
}

export function useReorderStatuses(): TrackerMutation<Status[], ReorderStatusesVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ids }: ReorderStatusesVariables) =>
      client.reorderStatuses(projectKey, ids),
    onMutate: ({ projectKey, ids }) =>
      applyOptimistic(
        queryClient,
        statusChanges(projectKey, (list) => reorderStatusList(list, ids)),
      ),
    onError: rollbackOnError,
    onSettled: (_statuses, _error, variables) => settleStatuses(queryClient, variables),
  });
}

export function useDeleteStatus(): TrackerMutation<void, DeleteStatusVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statusId, moveTo }: DeleteStatusVariables) =>
      client.deleteStatus(statusId, moveTo),
    onSettled: (_result, _error, variables) => settleStatuses(queryClient, variables),
  });
}
