import type { RunRequest } from '@tracker/shared';
import clsx from 'clsx';
import { useRef } from 'react';
import { requestName } from './copy';
import { PermissionAsk } from './PermissionAsk';
import { PlanAsk } from './PlanAsk';
import { QuestionAsk } from './QuestionAsk';
import styles from './Requests.module.css';
import { isOpen } from './requestState';
import { subjectOf } from './requestText';
import { SettledRequest } from './SettledRequest';
import { useAnswer, type Answer } from './useAnswer';

function OpenRequest({ request, answer }: { request: RunRequest; answer: Answer }) {
  if (request.kind === 'plan') return <PlanAsk request={request} answer={answer} />;
  if (request.kind === 'permission') return <PermissionAsk request={request} answer={answer} />;
  return <QuestionAsk questions={request.questions} answer={answer} />;
}

export function RequestCard({ request, now }: { request: RunRequest; now: number }) {
  const cardRef = useRef<HTMLElement>(null);
  const answer = useAnswer(request, cardRef);
  const open = isOpen(request, now);
  return (
    <section
      ref={cardRef}
      aria-label={requestName(subjectOf(request))}
      className={clsx(styles.card, open ? 'fade-in' : styles.settled)}
      data-open={open || undefined}
    >
      {!open ? (
        <SettledRequest request={request} now={now} takeFocus={answer.focusAnswer} />
      ) : (
        <OpenRequest request={request} answer={answer} />
      )}
    </section>
  );
}
