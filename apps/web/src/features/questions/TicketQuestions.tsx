import { useMemo } from 'react';
import { useTicketQuestions } from '../../api/hooks/questions';
import { useNow } from '../../lib/useNow';
import requestStyles from '../requests/Requests.module.css';
import { useAnnounceRequests } from '../requests/useAnnounceRequests';
import { QuestionCard } from './QuestionCard';
import styles from './TicketQuestions.module.css';
import { shownQuestions } from './shownQuestions';

export function TicketQuestions({ ticketKey }: { ticketKey: string }) {
  const { data } = useTicketQuestions(ticketKey);
  const now = useNow();
  const shown = useMemo(() => shownQuestions(data ?? [], now), [data, now]);
  useAnnounceRequests(shown, now);
  if (shown.length === 0) return null;
  return (
    <section
      aria-label="Claude's questions"
      className={`${styles.questions} ${requestStyles.cards}`}
    >
      {shown.map((request) => (
        <QuestionCard key={request.id} ticketKey={ticketKey} request={request} now={now} />
      ))}
    </section>
  );
}
