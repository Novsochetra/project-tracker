import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '11111111-2222-4333-8444-555555555555';

describe.each(DIALECTS)('stopping Claude from the chat (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const ask = (chatId: string, body: object = {}) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text: 'And the tests?',
      ...body,
    });
  const next = (lane: 'ask' | 'ticket' = 'ask') =>
    helper<RunJob>('POST', `/api/runners/${runner}/next?kind=${lane}`);
  const finish = (id: string, body: object) => helper<Run>('POST', `/api/runs/${id}/finish`, body);
  const stop = (id: string | undefined) => person<Run>('POST', `/api/runs/${id ?? ''}/cancel`);
  const chat = async (id: string) => (await person<ChatDetail>('GET', `/api/chats/${id}`)).body;

  async function answeredChat(): Promise<string> {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'How does sync work?',
    });
    const job = (await next()).body;
    clock.advance(1_000);
    await finish(job.run.id, { status: 'done', answer: 'Every minute.', sessionId: SESSION });
    clock.advance(1_000);
    return started.body.chat.id;
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('lets the person stop a running question, adds no answer, and asks again with the session', async () => {
    const chatId = await answeredChat();
    const asked = await ask(chatId);
    const job = (await next()).body;

    const stopped = await stop(asked.body.run?.id);
    expect(stopped.status).toBe(200);
    expect(stopped.body).toMatchObject({ id: job.run.id, status: 'cancelled', error: null });
    expect((await finish(job.run.id, { status: 'cancelled' })).status).toBe(200);
    const late = await finish(job.run.id, { status: 'done', answer: 'Half', sessionId: SESSION });
    expect(late.status).toBe(409);
    const after = await chat(chatId);
    expect(after.messages.map(({ role }) => role)).toEqual(['person', 'claude', 'person']);
    expect(after.run).toMatchObject({ status: 'cancelled' });

    expect((await ask(chatId)).status).toBe(200);
    expect((await next()).body.resumeSessionId).toBe(SESSION);
  });

  it('stops a question that is still queued, so the helper never takes it', async () => {
    const chatId = await answeredChat();
    const asked = await ask(chatId);
    expect((await stop(asked.body.run?.id)).body.status).toBe('cancelled');
    expect((await next()).status).toBe(204);
  });

  it('stops an Edit question in the ticket lane', async () => {
    const chatId = await answeredChat();
    const asked = await ask(chatId, { mode: 'edit' });
    expect((await next('ticket')).body.run.id).toBe(asked.body.run?.id);
    expect((await stop(asked.body.run?.id)).body).toMatchObject({
      status: 'cancelled',
      askOptions: { model: 'default', mode: 'edit' },
    });
    expect((await ask(chatId)).status).toBe(200);
  });
});
