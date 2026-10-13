import type { RunRequest } from '@tracker/shared';
import clsx from 'clsx';
import { useRef } from 'react';
import { useAnswerQuestion } from '../../api/hooks/questions';
import { requestName } from '../requests/copy';
import { QuestionAsk } from '../requests/QuestionAsk';
import styles from '../requests/Requests.module.css';
import { isOpen } from '../requests/requestState';
import { subjectOf } from '../requests/requestText';
import { SettledRequest } from '../requests/SettledRequest';
import { useAnswerWith } from '../requests/useAnswer';
import { questionAnswer } from './questionRequest';

export interface QuestionCardProps {
  ticketKey: string;
  request: RunRequest;
  now: number;
}

export function QuestionCard({ ticketKey, request, now }: QuestionCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const mutation = useAnswerQuestion(ticketKey);
  const answer = useAnswerWith(
    {
      pending: mutation.isPending,
      mutate: (input, onError) =>
        mutation.mutate({ questionId: request.id, input: questionAnswer(input) }, { onError }),
    },
    cardRef,
  );
  const open = isOpen(request, now);
  return (
    <section
      ref={cardRef}
      aria-label={requestName(subjectOf(request))}
      className={clsx(styles.card, open ? 'fade-in' : styles.settled)}
      data-open={open || undefined}
    >
      {open && request.kind === 'question' ? (
        <QuestionAsk questions={request.questions} answer={answer} />
      ) : (
        <SettledRequest request={request} now={now} takeFocus={answer.focusAnswer} />
      )}
    </section>
  );
}
