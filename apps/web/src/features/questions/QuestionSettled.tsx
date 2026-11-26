import type { TicketQuestion } from '@tracker/shared';
import { Check, CircleSlash, Clock, MessageCircleQuestion, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Icon } from '../../components';
import styles from './QuestionCard.module.css';
import { outcomeLines, questionOutcome, subjectOf, type Outcome } from './questionText';

const OUTCOME_ICONS: Record<Outcome, LucideIcon> = {
  answered: Check,
  skipped: CircleSlash,
  none: Clock,
};

export interface QuestionSettledProps {
  question: TicketQuestion;
  now: number;
  takeFocus: boolean;
}

export function QuestionSettled({ question, now, takeFocus }: QuestionSettledProps) {
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (takeFocus) outcomeRef.current?.focus({ preventScroll: true });
  }, [takeFocus]);
  const outcome = questionOutcome(question, now);

  return (
    <div className={`${styles.settledBody} fade-in`}>
      <p className={styles.subject}>
        <Icon icon={MessageCircleQuestion} size={14} className={styles.subjectIcon} />
        <span className={styles.subjectText}>{subjectOf(question)}</span>
      </p>
      <p ref={outcomeRef} tabIndex={-1} className={styles.outcome} data-outcome={outcome}>
        <Icon icon={OUTCOME_ICONS[outcome]} size={14} className={styles.outcomeIcon} />
        <span className={styles.outcomeLines}>
          {outcomeLines(question, now).map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </span>
      </p>
    </div>
  );
}
