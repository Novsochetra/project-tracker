import type { ErrorBody, TicketQuestion } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApiToken } from '../../src/auth/apiTokens';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const ASKED = { question: 'Which name should the setting have?', choices: ['Dark', 'Night'] };

const REFUSED: ErrorBody = {
  error: { code: 'forbidden', message: 'Only the API token that asked a question can cancel it.' },
};

// PT-276: any API token of the user could cancel any open question, so one agent could end the
// question another was waiting on, before the person answered it.
describe.each(DIALECTS)('regression: an agent cancels another agent’s question (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let asker: Caller;
  let otherAgent: Caller;

  const ask = async (as: Caller) =>
    (await as<TicketQuestion>('POST', '/api/tickets/MOB-1/questions', ASKED)).body;
  const cancel = (id: string, as: Caller) =>
    as<TicketQuestion>('POST', `/api/questions/${id}/cancel`);
  const statuses = async () =>
    (await person<TicketQuestion[]>('GET', '/api/tickets/MOB-1/questions')).body.map(
      (question) => question.status,
    );

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now(), 'owner');
    const second = await createApiToken(api.db, owner.id, 'second laptop', Date.now());
    person = caller(() => api.app, owner.person);
    asker = caller(() => api.app, owner.helper);
    otherAgent = caller(() => api.app, { token: second.secret });
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Dark mode' });
  });

  it('answers 403 to another token and leaves the question open', async () => {
    const question = await ask(asker);

    expect(await cancel(question.id, otherAgent)).toEqual({ status: 403, body: REFUSED });
    expect(await statuses()).toEqual(['open']);

    expect((await cancel(question.id, asker)).body).toMatchObject({ status: 'cancelled' });
  });

  it('lets the person cancel any of their questions', async () => {
    const question = await ask(asker);

    expect((await cancel(question.id, person)).body).toMatchObject({ status: 'cancelled' });
  });

  it('lets any token cancel a question no token asked, as before', async () => {
    const question = await ask(person);

    expect((await cancel(question.id, otherAgent)).body).toMatchObject({ status: 'cancelled' });
  });
});

describe.each(DIALECTS)('regression: a question on a tracker without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('may be cancelled by any agent, as no token asked it', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile', key: 'MOB' });
    await person.createTicket('MOB', { title: 'Dark mode' });
    const question = await api.client(agent('Worker')).askQuestion('MOB-1', ASKED);

    const cancelled = await api.client(agent('Reviewer')).cancelQuestion(question.id);

    expect(cancelled).toMatchObject({ status: 'cancelled' });
  });
});
