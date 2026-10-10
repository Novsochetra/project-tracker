import type { AnswerRunRequestInput, RunRequest } from '@tracker/shared';
import { useState, type MouseEvent, type RefObject } from 'react';
import { errorMessage } from '../../api/errors';
import { useAnswerRunRequest } from '../../api/hooks/runRequests';
import { useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { isSettledElsewhere } from './answerRefusal';

export interface Answer {
  pending: boolean;
  // Focus was in the card when it was answered, so it goes to the answer, not to the page's top.
  focusAnswer: boolean;
  send: (input: AnswerRunRequestInput, event?: MouseEvent<HTMLElement>) => void;
}

export function useAnswer(request: RunRequest, cardRef: RefObject<HTMLElement | null>): Answer {
  const mutation = useAnswerRunRequest();
  const toast = useToast();
  const [focusAnswer, setFocusAnswer] = useState(false);
  const send = (input: AnswerRunRequestInput, event?: MouseEvent<HTMLElement>) => {
    if (mutation.isPending) return;
    // The card shrinks to its answer, so what moves up under the finger must not take a double
    // tap's second tap.
    if (event && event.detail !== 0) holdPresses(event.currentTarget);
    setFocusAnswer(cardRef.current?.contains(document.activeElement) ?? false);
    mutation.mutate(
      { request, input },
      {
        onError: (error) => {
          if (!isSettledElsewhere(error)) toast.show(errorMessage(error), { kind: 'error' });
        },
      },
    );
  };
  return { pending: mutation.isPending, focusAnswer, send };
}
