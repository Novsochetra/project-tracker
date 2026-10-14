import { CHAT_NO_ANSWER } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { endingOf } from '../../src/services/runEnding';

const SESSION = '11111111-2222-4333-8444-555555555555';
const ticket = { kind: 'ticket' as const };
const ask = { kind: 'ask' as const };

describe('endingOf', () => {
  it('ends a ticket run as the helper says, dropping an error on success', () => {
    expect(endingOf(ticket, { status: 'done', error: 'x', answer: 'y' })).toEqual({
      status: 'done',
      error: null,
      answer: null,
    });
    expect(endingOf(ticket, { status: 'failed', error: ' boom ' })).toEqual({
      status: 'failed',
      error: 'boom',
      answer: null,
    });
  });

  it("keeps an ask's answer and session", () => {
    expect(endingOf(ask, { status: 'done', answer: ' Yes. ', sessionId: SESSION })).toEqual({
      status: 'done',
      error: null,
      answer: { text: 'Yes.', sessionId: SESSION, attachmentIds: [] },
    });
  });

  it("keeps the pictures an ask's answer shows", () => {
    const ended = endingOf(ask, { status: 'done', answer: 'See.', attachmentIds: ['a', 'b'] });
    expect(ended.answer?.attachmentIds).toEqual(['a', 'b']);
  });

  it('fails an ask that is done without an answer', () => {
    expect(endingOf(ask, { status: 'done', answer: '  ' })).toEqual({
      status: 'failed',
      error: CHAT_NO_ANSWER,
      answer: null,
    });
  });

  it('ends a cancelled ask with no answer', () => {
    expect(endingOf(ask, { status: 'cancelled', answer: 'half' }).answer).toBeNull();
  });
});
