import type { TicketQuestion } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { asRunRequest, questionAnswer } from './questionRequest';

const open: TicketQuestion = {
  id: 'q1',
  ticketId: 't1',
  runId: null,
  text: 'Which name?',
  choices: ['Dark', 'Night'],
  status: 'open',
  answer: null,
  createdAt: 1,
  expiresAt: 2,
  endedAt: null,
};

describe('asRunRequest', () => {
  it('reads a question as one single-choice question of a run request', () => {
    expect(asRunRequest(open)).toEqual({
      kind: 'question',
      label: 'Which name?',
      labelCut: false,
      questions: [
        {
          question: 'Which name?',
          header: '',
          options: [
            { label: 'Dark', description: '' },
            { label: 'Night', description: '' },
          ],
          multiSelect: false,
        },
      ],
      id: 'q1',
      runId: '',
      status: 'open',
      decision: null,
      answers: null,
      createdAt: 1,
      expiresAt: 2,
      endedAt: null,
    });
  });

  it('reads an answer as allowed with it, a skip as a deny, and an end as no answer', () => {
    const answered = asRunRequest({ ...open, status: 'answered', answer: 'Night', endedAt: 2 });
    expect(answered).toMatchObject({ status: 'answered', decision: 'allow', answers: ['Night'] });
    const skipped = asRunRequest({ ...open, status: 'skipped', endedAt: 2 });
    expect(skipped).toMatchObject({ status: 'answered', decision: 'deny', answers: null });
    expect(asRunRequest({ ...open, status: 'expired' })).toMatchObject({ status: 'expired' });
    expect(asRunRequest({ ...open, status: 'cancelled' })).toMatchObject({ decision: null });
  });
});

describe('questionAnswer', () => {
  it("sends the card's answer, or a skip for its Skip", () => {
    expect(questionAnswer({ decision: 'allow', answers: ['Night'] })).toEqual({ answer: 'Night' });
    expect(questionAnswer({ decision: 'deny' })).toEqual({ skip: true });
  });
});
