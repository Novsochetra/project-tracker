import { randomUUID } from 'node:crypto';
import { RUN_RESTARTED, type ChatDetail, type Run, type RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('question options and lanes (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const startChat = (body: object) =>
    person<ChatDetail>('POST', '/api/projects/MOB/chats', { runnerId: runner, text: 'Q', ...body });
  const ask = (chatId: string, body: object) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text: 'Q',
      ...body,
    });
  const next = (lane: 'ticket' | 'ask') =>
    helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=${lane}`);
  const run = async (id: string | undefined) =>
    (await person<Run>('GET', `/api/runs/${id ?? ''}`)).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('keeps each question’s choice on its run and the last one on the chat', async () => {
    const started = await startChat({ model: 'opus', mode: 'plan' });
    expect(started.body.chat.options).toEqual({ model: 'opus', mode: 'plan' });
    expect(started.body.run?.askOptions).toEqual({ model: 'opus', mode: 'plan' });
    const job = (await next('ask')).body;
    expect(job?.run.askOptions).toEqual({ model: 'opus', mode: 'plan' });
    expect(job?.prompt).toContain('read-only');
    await helper('POST', `/api/runs/${job?.run.id ?? ''}/finish`, { status: 'done', answer: 'A' });

    clock.advance(1_000);
    const again = await ask(started.body.chat.id, { model: 'sonnet', mode: 'ask' });
    expect(again.body.chat.options).toEqual({ model: 'sonnet', mode: 'ask' });
    expect(again.body.run?.askOptions).toEqual({ model: 'sonnet', mode: 'ask' });
    expect((await run(started.body.run?.id)).askOptions).toEqual({ model: 'opus', mode: 'plan' });
  });

  it.each([{ model: 'gpt' }, { mode: 'yolo' }, { mode: '--dangerously-skip-permissions' }])(
    'refuses %o and queues nothing',
    async (options) => {
      expect((await startChat(options)).status).toBe(400);
      expect((await next('ask')).status).toBe(204);
      expect((await person<unknown[]>('GET', '/api/projects/MOB/chats')).body).toEqual([]);
    },
  );

  it('lets only a person ask for an Edit', async () => {
    const refused = await helper('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Q',
      mode: 'edit',
    });
    expect(refused.status).toBe(403);
  });

  it('runs an Edit question in the ticket lane with a prompt that may change files', async () => {
    const started = await startChat({ mode: 'edit' });
    expect((await next('ask')).status).toBe(204);
    const job = (await next('ticket')).body;
    expect(job?.run).toMatchObject({ id: started.body.run?.id, kind: 'ask' });
    expect(job?.run.askOptions).toEqual({ model: 'default', mode: 'edit' });
    expect(job?.prompt).not.toContain('read-only');
  });

  it('keeps a running Edit question when the ask lane takes, and ends it when the ticket lane does', async () => {
    const edit = await startChat({ mode: 'edit' });
    await next('ticket');
    await startChat({ mode: 'ask' });
    expect((await next('ask')).status).toBe(200);
    expect((await run(edit.body.run?.id)).status).toBe('running');

    expect((await next('ticket')).status).toBe(204);
    expect(await run(edit.body.run?.id)).toMatchObject({ status: 'failed', error: RUN_RESTARTED });
  });

  it('waits an Edit question behind a ticket run queued before it', async () => {
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    const ticketRun = await person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Fix MOB-1',
    });
    clock.advance(1_000);
    await startChat({ mode: 'edit' });
    expect((await next('ticket')).body?.run.id).toBe(ticketRun.body.id);
  });
});
