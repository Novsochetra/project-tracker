import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunAllInput, RunAllPreview, RunAllResult, RunBatch } from '@tracker/shared';
import { useApi } from '../context';
import { refreshBatches } from '../live/refreshBatches';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { WORKING_RUN_REFRESH_MS } from '../workingRun';

const isActive = (batch: RunBatch | undefined): boolean =>
  batch?.status === 'queued' || batch?.status === 'running';

// Events refresh a batch as its tickets move; the timer is for a helper that went silent.
export function useRunBatch(runId: string | null): TrackerQuery<RunBatch> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.runBatch(runId ?? ''),
    queryFn: () => client.getRunBatch(runId ?? ''),
    enabled: runId !== null,
    refetchInterval: (query) => (isActive(query.state.data) ? WORKING_RUN_REFRESH_MS : false),
  });
}

export function useRunAllPreview(projectKey: string, enabled = true): TrackerQuery<RunAllPreview> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.runAllPreview(projectKey),
    queryFn: () => client.previewRunAll(projectKey),
    enabled,
    staleTime: 0,
  });
}

export interface CardRunAllVariables {
  chatId: string;
  projectKey: string;
  messageId: string;
  input: RunAllInput;
}

export function useRunAllFromCard(): TrackerMutation<RunAllResult, CardRunAllVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageId, input }: CardRunAllVariables) =>
      client.runAllFromCard(chatId, messageId, input),
    // The chat's message now holds the batch, so the card shows its progress, not Confirm.
    onSettled: (_result, _error, { chatId, projectKey }) => {
      refreshBatches(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.runAllPreview(projectKey) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat(chatId), exact: true });
    },
  });
}
