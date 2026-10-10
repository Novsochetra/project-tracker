import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerRunRequestInput, RunRequest } from '@tracker/shared';
import { useApi } from '../context';
import { isNotFound } from '../errors';
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
// again, so the card shows how it ended. A 404 means the run is gone (its ticket or chat deleted):
// a read would 404 too and leave its cards up, so they go.
export function useAnswerRunRequest(): TrackerMutation<RunRequest, AnswerVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, input }: AnswerVariables) => client.answerRunRequest(request.id, input),
    onSuccess: (answered) =>
      queryClient.setQueryData<RunRequest[]>(queryKeys.runRequests(answered.runId), (have) =>
        withRequest(have, answered),
      ),
    onError: (error, { request }) => {
      const queryKey = queryKeys.runRequests(request.runId);
      if (isNotFound(error)) queryClient.setQueryData<RunRequest[]>(queryKey, []);
      else void queryClient.invalidateQueries({ queryKey, exact: true });
    },
  });
}
