import { useState, type MouseEvent, type RefObject } from 'react';
import { errorMessage } from '../../api/errors';
import { useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { isSettledElsewhere } from './answerRefusal';

export interface Answer<Input> {
  pending: boolean;
  // Focus was in the card when it was answered, so it goes to the answer, not to the page's top.
  focusAnswer: boolean;
  send: (input: Input, event?: MouseEvent<HTMLElement>) => void;
}

export interface AnswerSender<Input> {
  pending: boolean;
  mutate: (input: Input, onError: (error: Error) => void) => void;
}

export function useAnswerWith<Input>(
  sender: AnswerSender<Input>,
  cardRef: RefObject<HTMLElement | null>,
): Answer<Input> {
  const toast = useToast();
  const [focusAnswer, setFocusAnswer] = useState(false);
  const send = (input: Input, event?: MouseEvent<HTMLElement>) => {
    if (sender.pending) return;

    // The card shrinks to its answer, so what moves up under the finger must not take a double
    // tap's second tap.
    if (event && event.detail !== 0) holdPresses(event.currentTarget);
    setFocusAnswer(cardRef.current?.contains(document.activeElement) ?? false);
    sender.mutate(input, (error) => {
      if (!isSettledElsewhere(error)) toast.show(errorMessage(error), { kind: 'error' });
    });
  };

  return { pending: sender.pending, focusAnswer, send };
}
