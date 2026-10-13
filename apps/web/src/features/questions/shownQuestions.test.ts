import type { TicketQuestion } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { SETTLED_SHOWN_MS, shownQuestions } from './shownQuestions';

const NOW = 10_000_000;

const question = (id: string, more: Partial<TicketQuestion> = {}): TicketQuestion => ({
  id,
  ticketId: 't1',
  runId: null,
  text: `Question ${id}?`,
  choices: [],
  status: 'open',
  answer: null,
  createdAt: NOW - 1000,
  expiresAt: NOW + 1000,
  endedAt: null,
  ...more,
});

const ids = (questions: TicketQuestion[]) => shownQuestions(questions, NOW).map(({ id }) => id);

describe('shownQuestions', () => {
  it('shows every open question and the one answered last', () => {
    const answered = (id: string, endedAt: number) =>
      question(id, { status: 'answered', answer: 'Yes', endedAt });
    expect(ids([answered('a', NOW - 500), answered('b', NOW - 100), question('c')])).toEqual([
      'b',
      'c',
    ]);
  });

  it('lets an old answer go, and one past its deadline by the clock stays as no answer a while', () => {
    const old = question('old', { status: 'answered', endedAt: NOW - SETTLED_SHOWN_MS });
    expect(ids([old])).toEqual([]);
    const overdue = question('late', { expiresAt: NOW - 1 });
    expect(shownQuestions([overdue], NOW)).toMatchObject([{ id: 'late', status: 'open' }]);
  });
});
