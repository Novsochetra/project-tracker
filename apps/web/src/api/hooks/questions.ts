import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerQuestionInput, TicketQuestion } from '@tracker/shared';
import { useApi } from '../context';
import { isNotFound } from '../errors';
import { queryKeys } from '../queryKeys';
import { withRequest } from '../runRequests';
import type { TrackerMutation, TrackerQuery } from '../types';

export interface AnswerQuestionVariables {
  questionId: string;
  input: AnswerQuestionInput;
}

// Read again on the ticket's change events, a ticket run's end and a reconnect (api/live).
export function useTicketQuestions(ticketKey: string): TrackerQuery<TicketQuestion[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ticketQuestions(ticketKey),
    queryFn: () => client.listQuestions(ticketKey),
  });
}

// A refused answer (another device answered first, or the question ended) reads the questions
// again, so the card shows how it ended. A 404 means the ticket is gone, so its cards go.
export function useAnswerQuestion(
  ticketKey: string,
): TrackerMutation<TicketQuestion, AnswerQuestionVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ticketQuestions(ticketKey);
  return useMutation({
    mutationFn: ({ questionId, input }: AnswerQuestionVariables) =>
      client.answerQuestion(questionId, input),
    onSuccess: (answered) =>
      queryClient.setQueryData<TicketQuestion[]>(queryKey, (have) => withRequest(have, answered)),
    onError: (error) => {
      if (isNotFound(error)) queryClient.setQueryData<TicketQuestion[]>(queryKey, []);
      else void queryClient.invalidateQueries({ queryKey, exact: true });
    },
  });
}
