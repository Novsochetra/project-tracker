import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Run, RunAllInput, RunAllResult, Runner, StartRunInput } from '@tracker/shared';
import { useApi } from '../context';
import { refreshBatches } from '../live/refreshBatches';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { runsRefreshMs } from '../workingRun';

// Helpers check in about every 20 s without an event, so an open list asks as often to show one
// coming online or going.
export const RUNNERS_REFRESH_MS = 20_000;

export interface StartRunVariables {
  ticketKey: string;
  input: StartRunInput;
}

export function useRunners({ enabled = true }: { enabled?: boolean } = {}): TrackerQuery<Runner[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.runners(),
    queryFn: () => client.listRunners(),
    enabled,
    staleTime: 0,
    refetchInterval: RUNNERS_REFRESH_MS,
  });
}

export function useTicketRuns(ticketKey: string): TrackerQuery<Run[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ticketRuns(ticketKey),
    queryFn: () => client.listTicketRuns(ticketKey),
    refetchInterval: (query) => runsRefreshMs(query.state.data),
  });
}

// Only a ticket's runs are listed by ticket; an ask shows in its chat.
export function showRun(queryClient: QueryClient, run: Run): void {
  if (!run.ticketKey) return;
  queryClient.setQueryData<Run[]>(queryKeys.ticketRuns(run.ticketKey), (runs = []) =>
    runs.some(({ id }) => id === run.id)
      ? runs.map((shown) => (shown.id === run.id ? run : shown))
      : [run, ...runs],
  );
}

export const invalidateRuns = (queryClient: QueryClient, ticketKey: string | null) => {
  if (ticketKey) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticketRuns(ticketKey), exact: true });
  }
};

export function useStartRun(): TrackerMutation<Run, StartRunVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, input }: StartRunVariables) => client.startRun(ticketKey, input),
    onSuccess: (run) => showRun(queryClient, run),
    // A 409 means a run started elsewhere, which the ticket should show now.
    onSettled: (_run, _error, { ticketKey }) => invalidateRuns(queryClient, ticketKey),
  });
}

export function useCancelRun(): TrackerMutation<Run, Run> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: Run) => client.cancelRun(run.id),
    onSuccess: (run) => showRun(queryClient, run),
    onSettled: (_run, _error, run) => invalidateRuns(queryClient, run.ticketKey),
  });
}

export interface RunAllVariables {
  projectKey: string;
  input: RunAllInput;
}

export function useRunAllTodo(): TrackerMutation<RunAllResult, RunAllVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: RunAllVariables) => client.runAllTodo(projectKey, input),
    // Each ticket's own run list refreshes when its run event arrives.
    onSettled: (_result, _error, { projectKey }) => {
      refreshBatches(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.runAllPreview(projectKey) });
    },
  });
}
