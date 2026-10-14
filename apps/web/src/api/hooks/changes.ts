import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewVerdict,
  TicketChangesAnswer,
  TicketDetail,
  ViewedFileInput,
} from '@tracker/shared';
import { useApi } from '../context';
import { applyOptimistic, cacheChange, rollbackOnError } from '../optimistic';
import { queryKeys } from '../queryKeys';
import { settleMutation } from '../refresh';
import type { TrackerMutation, TrackerQuery } from '../types';

// Read again on the ticket's change events (api/live), which the tracker sends when a run's
// changes arrive and when a tick or a verdict changes them.
export function useTicketChanges(ticketKey: string): TrackerQuery<TicketChangesAnswer> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ticketChanges(ticketKey),
    queryFn: () => client.getTicketChanges(ticketKey),
  });
}

const changesChange = (
  ticketKey: string,
  update: (answer: TicketChangesAnswer) => TicketChangesAnswer,
) => cacheChange(queryKeys.ticketChanges(ticketKey), update);

function withViewed(answer: TicketChangesAnswer, input: ViewedFileInput): TicketChangesAnswer {
  if (!answer.changes) return answer;
  const { [input.path]: _dropped, ...rest } = answer.changes.viewed;
  const viewed = input.viewed ? { ...rest, [input.path]: input.digest } : rest;
  return { changes: { ...answer.changes, viewed } };
}

export interface ViewedVariables {
  ticketKey: string;
  input: ViewedFileInput;
}

export function useSetFileViewed(): TrackerMutation<void, ViewedVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, input }: ViewedVariables) => client.setFileViewed(ticketKey, input),
    onMutate: ({ ticketKey, input }) =>
      applyOptimistic(queryClient, [
        changesChange(ticketKey, (answer) => withViewed(answer, input)),
      ]),
    onError: rollbackOnError,
    onSettled: (_data, _error, { ticketKey }) =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketChanges(ticketKey) }),
  });
}

export interface VerdictVariables {
  ticketKey: string;
  projectKey: string;
  runId: string;
  verdict: ReviewVerdict;
}

export function useChangesVerdict(): TrackerMutation<TicketDetail, VerdictVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, runId, verdict }: VerdictVariables) =>
      client.sendChangesVerdict(ticketKey, { runId, verdict }),
    onSuccess: (detail, { ticketKey }) =>
      queryClient.setQueryData(queryKeys.ticket(ticketKey), detail),
    onSettled: (_detail, _error, variables) => settleMutation(queryClient, variables),
  });
}
