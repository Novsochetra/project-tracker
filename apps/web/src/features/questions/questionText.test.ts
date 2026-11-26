import type { TicketQuestion } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { isOpen, questionState } from './questionState';
import { announcementOf, outcomeLines, questionOutcome, subjectOf } from './questionText';

const NOW = 10_000_000;

const question = (more: Partial<TicketQuestion> = {}): TicketQuestion => ({
  id: 'q-1',
  ticketId: 't-1',
  text: 'Which name?',
  choices: ['Dark', 'Night'],
  status: 'open',
  answer: null,
  createdAt: NOW - 1000,
  expiresAt: NOW + 1000,
  endedAt: null,
  ...more,
});

describe('a question on the phone', () => {
  it('is open until its deadline by the phone’s clock, before the tracker ends it', () => {
    expect(isOpen(question(), NOW)).toBe(true);
    expect(questionState(question({ expiresAt: NOW }), NOW)).toBe('ended');
    expect(questionState(question({ status: 'cancelled' }), NOW)).toBe('ended');
    expect(questionState(question({ status: 'skipped' }), NOW)).toBe('answered');
  });

  it('says how it ended: the answer, Skipped or No answer', () => {
    const answered = question({ status: 'answered', answer: 'Night', endedAt: NOW });
    expect(questionOutcome(answered, NOW)).toBe('answered');
    expect(outcomeLines(answered, NOW)).toEqual(['Night']);
    expect(outcomeLines(question({ status: 'skipped', endedAt: NOW }), NOW)).toEqual(['Skipped']);
    expect(outcomeLines(question({ status: 'expired', expiresAt: NOW }), NOW)).toEqual([
      'No answer',
    ]);
  });

  it('marks what hides or reorders text where it names the question', () => {
    const hidden = question({ text: 'Delete ‮txt.exe?' });
    expect(subjectOf(hidden)).toBe('Delete \\u{202E}txt.exe?');
    expect(announcementOf(hidden)).toBe('An agent asks you: Delete \\u{202E}txt.exe?');
  });
});
