import type { TicketQuestion } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { withAnswered } from './withAnswered';

const question = (id: string): TicketQuestion => ({
  id,
  ticketId: 't-1',
  text: 'Which name?',
  choices: [],
  status: 'open',
  answer: null,
  createdAt: 1,
  expiresAt: 10,
  endedAt: null,
});

const open = question('q-1');
const other = question('q-2');
const answered: TicketQuestion = { ...open, status: 'answered', answer: 'Night', endedAt: 2 };

describe('withAnswered', () => {
  it('puts the answered question in its place', () => {
    expect(withAnswered([open, other], answered)).toEqual([answered, other]);
  });

  it('adds a question the list did not have yet', () => {
    expect(withAnswered(undefined, answered)).toEqual([answered]);
    expect(withAnswered([other], answered)).toEqual([other, answered]);
  });

  it('keeps a question a newer read already ended', () => {
    const expired: TicketQuestion = { ...open, status: 'expired', endedAt: 3 };
    const list = [expired, other];
    expect(withAnswered(list, answered)).toBe(list);
  });
});
