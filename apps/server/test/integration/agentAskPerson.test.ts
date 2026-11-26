import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askPerson } from '../../../agent/src/tools/askPerson';
import { NO_ANSWER, SKIPPED } from '../../../agent/src/tools/askPersonReply';
import { agent } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const QUESTION = 'Should the setting be called Dark mode or Night mode?';

describe.each(DIALECTS)('ask_person through the typed client (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const claude = () => api.client(agent('Claude'));
  const person = () => api.client();

  beforeEach(async () => {
    await person().createProject({ name: 'Mobile app' });
    await person().createTicket('MA', { title: 'Dark mode for Settings' });
  });

  const ask = (signal = new AbortController().signal) =>
    askPerson.handler(
      claude(),
      askPerson.input.parse({
        ticket: 'ma-1',
        question: QUESTION,
        choices: ['Dark mode', 'Night mode'],
      }),
      { signal },
    );

  const openQuestion = () =>
    vi.waitFor(async () => {
      const [question] = await person().listQuestions('MA-1');
      if (question?.status !== 'open') throw new Error('Nothing asked yet.');

      return question;
    });

  const waitingUntil = async () =>
    (await person().listTickets('MA')).find(({ key }) => key === 'MA-1')?.waitingUntil ?? null;

  it('marks the ticket while the agent waits, and gives it the answer', async () => {
    const reply = ask();
    const question = await openQuestion();
    expect(question).toMatchObject({ text: QUESTION, choices: ['Dark mode', 'Night mode'] });
    expect(await waitingUntil()).toBe(question.expiresAt);

    await person().answerQuestion(question.id, { answer: 'Night mode' });
    expect((await reply).text).toBe('The person answered: Night mode');
    expect(await waitingUntil()).toBeNull();
    const { activity } = await person().getTicket('MA-1');
    const said = activity.map(({ actor, text }) => `${actor.kind}: ${text}`);
    expect(said).toEqual(
      expect.arrayContaining([`agent: asked: ${QUESTION}`, 'human: answered: Night mode']),
    );
  });

  it('lets the agent go on when the person skips', async () => {
    const reply = ask();
    const question = await openQuestion();
    await person().answerQuestion(question.id, { skip: true });
    expect((await reply).text).toBe(SKIPPED);
  });

  it('ends the question on the tracker when the agent stops waiting', async () => {
    const stop = new AbortController();
    const reply = ask(stop.signal);
    const question = await openQuestion();
    stop.abort();
    expect((await reply).text).toBe(NO_ANSWER);
    const [ended] = await person().listQuestions('MA-1');
    expect(ended).toMatchObject({ id: question.id, status: 'cancelled' });
    expect(await waitingUntil()).toBeNull();
  });

  it('never lets the agent answer its own question', async () => {
    const reply = ask();
    const question = await openQuestion();
    await expect(claude().answerQuestion(question.id, { answer: 'Dark mode' })).rejects.toThrow(
      'Only a person answers what Claude asks.',
    );
    await person().answerQuestion(question.id, { answer: 'Dark mode' });
    expect((await reply).text).toBe('The person answered: Dark mode');
  });
});
