import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerRunRequestInput, RunRequest } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import { withRequest } from '../runRequests';
import type { TrackerMutation, TrackerQuery } from '../types';

export interface AnswerVariables {
  request: RunRequest;
  input: AnswerRunRequestInput;
}

// Read again on a request event, the run's own end and a reconnect (api/live); nothing polls.
export function useRunRequests(runId: string | null): TrackerQuery<RunRequest[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.runRequests(runId ?? ''),
    queryFn: () => client.listRunRequests(runId ?? ''),
    enabled: runId !== null,
  });
}

// A refused answer (another device answered first, or the request ended) reads the requests
// again, so the card shows how it ended.
export function useAnswerRunRequest(): TrackerMutation<RunRequest, AnswerVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, input }: AnswerVariables) => client.answerRunRequest(request.id, input),
    onSuccess: (answered) =>
      queryClient.setQueryData<RunRequest[]>(queryKeys.runRequests(answered.runId), (have) =>
        withRequest(have, answered),
      ),
    onError: (_error, { request }) =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.runRequests(request.runId),
        exact: true,
      }),
  });
}
