import { ApiError } from '@tracker/client';
import type { TicketQuestion } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { askPerson } from '../../src/tools/askPerson';
import { NO_ANSWER, SKIPPED } from '../../src/tools/askPersonReply';
import { fakeClient, returns } from '../fakeClient';
import { run } from './run';

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

const ended = (change: Partial<TicketQuestion>): TicketQuestion => ({ ...open, ...change });

function tracker(...waits: (TicketQuestion | Error)[]) {
  const answers = [...waits];
  return {
    askQuestion: vi.fn(returns(open)),
    waitForQuestion: vi.fn(() => {
      const next = answers.shift() ?? open;
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }),
    cancelQuestion: vi.fn(returns(ended({ status: 'cancelled' }))),
  };
}

const ask = (api: ReturnType<typeof tracker>) =>
  run(askPerson, fakeClient(api), {
    ticket: 'mob-3',
    question: ' Which name? ',
    choices: ['Dark', 'Night'],
  });

describe('ask_person', () => {
  it('asks on the ticket, waits through open polls, and returns the answer', async () => {
    const api = tracker(open, open, ended({ status: 'answered', answer: 'Night' }));
    const reply = await ask(api);
    expect(api.askQuestion).toHaveBeenCalledWith('MOB-3', {
      question: 'Which name?',
      choices: ['Dark', 'Night'],
    });
    expect(api.waitForQuestion).toHaveBeenCalledTimes(3);
    expect(reply.text).toBe('The person answered: Night');
    expect(api.cancelQuestion).not.toHaveBeenCalled();
  });

  it('lets Claude go on when the person skips or nobody answers', async () => {
    expect((await ask(tracker(ended({ status: 'skipped' })))).text).toBe(SKIPPED);
    expect((await ask(tracker(ended({ status: 'expired' })))).text).toBe(NO_ANSWER);
    expect((await ask(tracker(ended({ status: 'cancelled' })))).text).toBe(NO_ANSWER);
    expect(NO_ANSWER).toBe(
      'No answer yet: go on with your best judgment and note the assumption in a comment.',
    );
  });

  it('waits out a tracker that restarts', async () => {
    vi.useFakeTimers();
    try {
      const api = tracker(
        new TypeError('fetch failed'),
        ended({ status: 'answered', answer: 'A' }),
      );
      const reply = ask(api);
      await vi.runAllTimersAsync();
      expect((await reply).text).toBe('The person answered: A');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails when the tracker refuses the question', async () => {
    const api = tracker();
    api.askQuestion.mockRejectedValueOnce(
      new ApiError(404, 'not_found', 'Ticket MOB-3 was not found.'),
    );
    await expect(ask(api)).rejects.toThrow('Ticket MOB-3 was not found.');
    expect(api.waitForQuestion).not.toHaveBeenCalled();
  });

  it('ends the question on the tracker when Claude stops waiting', async () => {
    const api = tracker();
    const stop = new AbortController();
    api.waitForQuestion.mockImplementation(() => {
      stop.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const reply = await askPerson.handler(
      fakeClient(api),
      { ticket: 'MOB-3', question: 'Which?' },
      { signal: stop.signal },
    );
    expect(reply.text).toBe(NO_ANSWER);
    expect(api.cancelQuestion).toHaveBeenCalledWith('q1', expect.anything());
  });
});
