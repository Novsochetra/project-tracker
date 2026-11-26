import type { AnswerRunRequestInput, RunRequest } from '@tracker/shared';
import type { RefObject } from 'react';
import { useAnswerRunRequest } from '../../api/hooks/runRequests';
import { useAnswerWith, type Answer as SentAnswer } from '../questions/useAnswerWith';

export type Answer = SentAnswer<AnswerRunRequestInput>;

export function useAnswer(request: RunRequest, cardRef: RefObject<HTMLElement | null>): Answer {
  const mutation = useAnswerRunRequest();

  return useAnswerWith(
    {
      pending: mutation.isPending,
      mutate: (input, onError) => mutation.mutate({ request, input }, { onError }),
    },
    cardRef,
  );
}
