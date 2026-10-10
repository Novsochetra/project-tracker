import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ACTIVE_RUN_STATUSES,
  type Run,
  type Runner,
  type RunStatus,
  type StartRunInput,
} from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

// Helpers check in about every 20 s without an event, so an open list asks as often to show one
// coming online or going.
export const RUNNERS_REFRESH_MS = 20_000;

// The tracker ends a run whose helper went silent only when it is asked about runs.
export const WORKING_RUN_REFRESH_MS = 30_000;

const WORKING: readonly RunStatus[] = ACTIVE_RUN_STATUSES;

export const isWorking = (run: Run | undefined): boolean =>
  run !== undefined && WORKING.includes(run.status);

export const runsRefreshMs = (runs: readonly Run[] | undefined): number | false =>
  isWorking(runs?.[0]) ? WORKING_RUN_REFRESH_MS : false;

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

function showRun(queryClient: QueryClient, run: Run): void {
  queryClient.setQueryData<Run[]>(queryKeys.ticketRuns(run.ticketKey), (runs = []) =>
    runs.some(({ id }) => id === run.id)
      ? runs.map((shown) => (shown.id === run.id ? run : shown))
      : [run, ...runs],
  );
}

const refreshRuns = (queryClient: QueryClient, ticketKey: string) =>
  void queryClient.invalidateQueries({ queryKey: queryKeys.ticketRuns(ticketKey), exact: true });

export function useStartRun(): TrackerMutation<Run, StartRunVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, input }: StartRunVariables) => client.startRun(ticketKey, input),
    onSuccess: (run) => showRun(queryClient, run),
    // A 409 means a run started elsewhere, which the ticket should show now.
    onSettled: (_run, _error, { ticketKey }) => refreshRuns(queryClient, ticketKey),
  });
}

export function useCancelRun(): TrackerMutation<Run, Run> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: Run) => client.cancelRun(run.id),
    onSuccess: (run) => showRun(queryClient, run),
    onSettled: (_run, _error, run) => refreshRuns(queryClient, run.ticketKey),
  });
}
