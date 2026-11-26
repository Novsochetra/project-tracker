import type { AnswerQuestionInput, TicketQuestion } from '@tracker/shared';
import clsx from 'clsx';
import { useRef } from 'react';
import { useAnswerQuestion } from '../../api/hooks/questions';
import { questionName } from './copy';
import styles from './QuestionCard.module.css';
import { QuestionAsk } from './QuestionAsk';
import { QuestionSettled } from './QuestionSettled';
import { isOpen } from './questionState';
import { subjectOf } from './questionText';
import { useAnswerWith } from './useAnswerWith';

export interface QuestionCardProps {
  ticketKey: string;
  question: TicketQuestion;
  now: number;
}

export function QuestionCard({ ticketKey, question, now }: QuestionCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const mutation = useAnswerQuestion(ticketKey);
  const answer = useAnswerWith<AnswerQuestionInput>(
    {
      pending: mutation.isPending,
      mutate: (input, onError) => mutation.mutate({ questionId: question.id, input }, { onError }),
    },
    cardRef,
  );
  const open = isOpen(question, now);

  return (
    <section
      ref={cardRef}
      aria-label={questionName(subjectOf(question))}
      className={clsx(styles.card, open ? 'fade-in' : styles.settled)}
      data-open={open || undefined}
    >
      {open ? (
        <QuestionAsk question={question} answer={answer} />
      ) : (
        <QuestionSettled question={question} now={now} takeFocus={answer.focusAnswer} />
      )}
    </section>
  );
}
