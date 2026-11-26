import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateLabelInput,
  Label,
  ProjectBoard,
  ProjectDetail,
  TicketDetail,
  UpdateLabelInput,
} from '@tracker/shared';
import { removeLabel, reorderLabelList, upsertLabel, withLabels } from '../cache/labels';
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

// Only the labels sheet and the label picker use these, so they stay out of the api barrel and
// the first load.

export interface CreateLabelVariables {
  projectKey: string;
  input: CreateLabelInput;
}

export interface UpdateLabelVariables {
  projectKey: string;
  labelId: string;
  input: UpdateLabelInput;
}

export interface ReorderLabelsVariables {
  projectKey: string;
  ids: string[];
}

export interface DeleteLabelVariables {
  projectKey: string;
  labelId: string;
}

const labelChanges = (projectKey: string, update: (labels: Label[]) => Label[]): CacheChange[] => [
  cacheChange<ProjectDetail>(queryKeys.project(projectKey), (data) => withLabels(data, update)),
  cacheChange<ProjectBoard>(queryKeys.board(projectKey), (data) => withLabels(data, update)),
];

// Ticket details carry the label list too, so they refresh along with the project.
const settleLabels = (queryClient: QueryClient, variables: { projectKey: string }) =>
  settleMutation(queryClient, variables, { withTickets: true });

// A label made from a ticket's picker goes on that ticket at once, so its details need it before
// their refetch lands, or the new chip would blink in a moment late.
function patchTicketDetails(queryClient: QueryClient, projectKey: string, label: Label) {
  const wanted = projectKey.toUpperCase();
  queryClient.setQueriesData<TicketDetail>(
    { queryKey: ['ticket'], predicate: (query) => query.queryKey.length === 2 },
    (data) =>
      data && data.project.key.toUpperCase() === wanted
        ? withLabels(data, (list) => upsertLabel(list, label))
        : data,
  );
}

export function useCreateLabel(): TrackerMutation<Label, CreateLabelVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: CreateLabelVariables) =>
      client.createLabel(projectKey, input),
    onSuccess: async (label, { projectKey }) => {
      patchTicketDetails(queryClient, projectKey, label);
      await patchCaches(
        queryClient,
        labelChanges(projectKey, (list) => upsertLabel(list, label)),
      );
    },
    onSettled: (_label, _error, variables) => settleLabels(queryClient, variables),
  });
}

export function useUpdateLabel(): TrackerMutation<Label, UpdateLabelVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, input }: UpdateLabelVariables) => client.updateLabel(labelId, input),
    onSuccess: (label, { projectKey }) =>
      patchCaches(
        queryClient,
        labelChanges(projectKey, (list) => upsertLabel(list, label)),
      ),
    onSettled: (_label, _error, variables) => settleLabels(queryClient, variables),
  });
}

export function useReorderLabels(): TrackerMutation<Label[], ReorderLabelsVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, ids }: ReorderLabelsVariables) =>
      client.reorderLabels(projectKey, ids),
    onMutate: ({ projectKey, ids }) =>
      applyOptimistic(
        queryClient,
        labelChanges(projectKey, (list) => reorderLabelList(list, ids)),
      ),
    onError: rollbackOnError,
    onSettled: (_labels, _error, variables) => settleLabels(queryClient, variables),
  });
}

export function useDeleteLabel(): TrackerMutation<void, DeleteLabelVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId }: DeleteLabelVariables) => client.deleteLabel(labelId),
    onSuccess: (_result, { projectKey, labelId }) =>
      patchCaches(
        queryClient,
        labelChanges(projectKey, (list) => removeLabel(list, labelId)),
      ),
    onSettled: (_result, _error, variables) => settleLabels(queryClient, variables),
  });
}
