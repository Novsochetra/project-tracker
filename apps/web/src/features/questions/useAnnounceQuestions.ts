import type { TicketQuestion } from '@tracker/shared';
import { useEffect } from 'react';
import { announce } from '../../app/announce';
import { isOpen } from './questionState';
import { announcementOf } from './questionText';

const announced = new Set<string>();

// A question needs the person, so it is read out politely when it comes, and once.
export function useAnnounceQuestions(questions: readonly TicketQuestion[], now: number): void {
  useEffect(() => {
    const fresh = questions.filter(
      (question) => isOpen(question, now) && !announced.has(question.id),
    );
    fresh.forEach(({ id }) => announced.add(id));
    if (fresh.length > 0) announce(fresh.map(announcementOf).join('. '));
  }, [questions, now]);
}
