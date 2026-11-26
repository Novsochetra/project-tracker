import { useMemo } from 'react';
import { useTicketQuestions } from '../../api/hooks/questions';
import { useNow } from '../../lib/useNow';
import { QUESTIONS_NAME } from './copy';
import { QuestionCard } from './QuestionCard';
import styles from './TicketQuestions.module.css';
import { shownQuestions } from './shownQuestions';
import { useAnnounceQuestions } from './useAnnounceQuestions';

export function TicketQuestions({ ticketKey }: { ticketKey: string }) {
  const { data } = useTicketQuestions(ticketKey);
  const now = useNow();
  const shown = useMemo(() => shownQuestions(data ?? [], now), [data, now]);
  useAnnounceQuestions(shown, now);
  if (shown.length === 0) return null;

  return (
    <section aria-label={QUESTIONS_NAME} className={styles.questions}>
      {shown.map((question) => (
        <QuestionCard key={question.id} ticketKey={ticketKey} question={question} now={now} />
      ))}
    </section>
  );
}
